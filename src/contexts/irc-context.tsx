'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/auth-context';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface IrcMessage {
  id: string;
  msgid?: string;
  replyToMsgId?: string;
  type: 'message' | 'join' | 'part' | 'quit' | 'action' | 'notice' | 'system';
  nick: string;
  realname: string;
  text: string;
  timestamp: Date;
  isHighlight: boolean;
  isSelf: boolean;
}

export interface IrcMember {
  nick: string;
  realname: string;
  prefix: string; // '@' | '+' | '~' | '&' | '%' | ''
}

interface IrcContextValue {
  messages: IrcMessage[];
  members: IrcMember[];
  isConnected: boolean;
  sendMessage: (text: string, replyToMsgId?: string) => void;
  unreadMentions: number;
  clearUnreadMentions: () => void;
  myRealname: string;
  setChatOpen: (open: boolean) => void;
  highlightCounter: number;
}

const IrcContext = createContext<IrcContextValue | undefined>(undefined);

export function useIrc() {
  const ctx = useContext(IrcContext);
  if (!ctx) throw new Error('useIrc must be used within <IrcProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  IRC helpers                                                        */
/* ------------------------------------------------------------------ */

function parsePrefix(raw: string) {
  const m = raw.match(/^:?([^!]+)(?:!([^@]*))?(?:@(.*))?/);
  return m
    ? { nick: m[1], user: m[2] || '', host: m[3] || '' }
    : { nick: raw.replace(/^:/, ''), user: '', host: '' };
}

function unescapeTagValue(val: string): string {
  return val
    .replace(/\\:/g, ';')
    .replace(/\\s/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n');
}

function escapeTagValue(val: string): string {
  return val
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\:')
    .replace(/ /g, '\\s')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function parseIrcLine(line: string) {
  let s = line;
  const tags: Record<string, string> = {};
  let prefix = '';

  // IRCv3 message tags
  if (s.startsWith('@')) {
    const idx = s.indexOf(' ');
    const tagStr = s.substring(1, idx);
    s = s.substring(idx + 1);
    for (const part of tagStr.split(';')) {
      if (!part) continue;
      const eq = part.indexOf('=');
      if (eq !== -1) {
        tags[part.substring(0, eq)] = unescapeTagValue(part.substring(eq + 1));
      } else {
        tags[part] = '';
      }
    }
  }

  if (s.startsWith(':')) {
    const idx = s.indexOf(' ');
    prefix = s.substring(1, idx);
    s = s.substring(idx + 1);
  }

  const trailIdx = s.indexOf(' :');
  let trailing: string | undefined;
  if (trailIdx !== -1) {
    trailing = s.substring(trailIdx + 2);
    s = s.substring(0, trailIdx);
  }

  const parts = s.split(' ').filter(Boolean);
  const command = parts[0] || '';
  const params = parts.slice(1);
  if (trailing !== undefined) params.push(trailing);

  return { tags, prefix, command, params };
}

function randomNick(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = 'OCC_';
  for (let i = 0; i < 5; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
}

let _msgSeq = 0;
const nextId = () => `irc-${++_msgSeq}-${Date.now()}`;

const MAX_MESSAGES = 500;
const CHANNEL = '#OCC';

/* ------------------------------------------------------------------ */
/*  Audio                                                              */
/* ------------------------------------------------------------------ */

let _audioCtx: AudioContext | null = null;

/** Call once on a user‑gesture to unlock the AudioContext. */
export function initAudio() {
  if (typeof AudioContext !== 'undefined' && !_audioCtx) {
    _audioCtx = new AudioContext();
  }
}

function playBeep() {
  try {
    if (!_audioCtx) _audioCtx = new AudioContext();
    if (_audioCtx.state === 'suspended') _audioCtx.resume();

    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(_audioCtx.currentTime + 0.25);
  } catch {
    /* audio unavailable */
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function IrcProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  /* ---- refs (stable across renders, no re‑render on mutation) ---- */
  const wsRef = useRef<WebSocket | null>(null);
  const nickRef = useRef('');
  const realnameRef = useRef('');
  const n2rRef = useRef(new Map<string, string>()); // nick → realname
  const pendingNamesRef = useRef<string[]>([]);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registeredRef = useRef(false);
  const chatOpenRef = useRef(false);

  /* ---- state (drives UI) ---- */
  const [messages, setMessages] = useState<IrcMessage[]>([]);
  const [members, setMembers] = useState<IrcMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadMentions, setUnreadMentions] = useState(0);
  const [highlightCounter, setHighlightCounter] = useState(0);

  /* ---- derived ---- */
  const myRealname = user?.displayName || user?.email || 'Anonymous';

  /* ---- stable callbacks ---- */
  const setChatOpen = useCallback((open: boolean) => {
    chatOpenRef.current = open;
    if (open) setUnreadMentions(0);
  }, []);

  const clearUnreadMentions = useCallback(() => setUnreadMentions(0), []);

  const addMsg = useCallback(
    (m: Omit<IrcMessage, 'id'>) =>
      setMessages((prev) => {
        const next = [...prev, { ...m, id: nextId() }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      }),
    [],
  );

  const onHighlight = useCallback(() => {
    playBeep();
    setHighlightCounter((c) => c + 1);
    if (!chatOpenRef.current) setUnreadMentions((c) => c + 1);
  }, []);

  /* External send – used by consumers (sendMessage) */
  const sendMessage = useCallback(
    (text: string, replyToMsgId?: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || !text.trim()) return;

      const nick = nickRef.current;
      const rn = realnameRef.current;
      // Only send IRC reply tag for server-assigned msgids (local IDs start with 'irc-')
      const useTag = replyToMsgId && !replyToMsgId.startsWith('irc-');
      const tagStr = useTag ? `@+draft/reply=${escapeTagValue(replyToMsgId)} ` : '';

      if (text.startsWith('/me ')) {
        const action = text.substring(4);
        ws.send(`${tagStr}PRIVMSG ${CHANNEL} :\x01ACTION ${action}\x01\r\n`);
        addMsg({
          type: 'action',
          nick,
          realname: rn,
          text: action,
          timestamp: new Date(),
          isHighlight: false,
          isSelf: true,
          replyToMsgId,
        });
      } else {
        ws.send(`${tagStr}PRIVMSG ${CHANNEL} :${text}\r\n`);
        addMsg({
          type: 'message',
          nick,
          realname: rn,
          text,
          timestamp: new Date(),
          isHighlight: false,
          isSelf: true,
          replyToMsgId,
        });
      }
    },
    [addMsg],
  );

  /* ---- main connection effect ---- */
  useEffect(() => {
    // Only connect when a user is logged in
    const realname = user ? user.displayName || user.email || 'Anonymous' : null;

    if (!realname) {
      // tear down any existing connection
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      setIsConnected(false);
      setMessages([]);
      setMembers([]);
      n2rRef.current.clear();
      return;
    }

    realnameRef.current = realname;
    let dead = false; // flipped in cleanup

    function connect() {
      if (dead) return;
      if (
        wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING
      )
        return;

      const nick = randomNick();
      nickRef.current = nick;
      registeredRef.current = false;
      pendingNamesRef.current = [];

      const ircUrl = process.env.NEXT_PUBLIC_IRC_WS_URL || 'wss://bus.valware.uk:6698';
      const ws = new WebSocket(ircUrl);
      wsRef.current = ws;

      /* local helper that closes over `ws` */
      const raw = (line: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(line + '\r\n');
      };

      ws.onopen = () => {
        raw('CAP LS 302');
        raw(`NICK ${nick}`);
        raw(`USER ${nick} 0 * :${realname}`);
      };

      ws.onmessage = (ev) => {
        const lines = (ev.data as string).split('\r\n').filter(Boolean);
        for (const l of lines) handle(l);
      };

      ws.onclose = () => {
        if (registeredRef.current) {
          addMsg({
            type: 'system',
            nick: '',
            realname: '',
            text: 'Disconnected. Reconnecting…',
            timestamp: new Date(),
            isHighlight: false,
            isSelf: false,
          });
        }
        setIsConnected(false);
        setMembers([]);
        registeredRef.current = false;
        if (!dead) reconnectRef.current = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        /* onclose will fire next */
      };

      /* ----- IRC line handler ----- */
      function handle(line: string) {
        const { tags, prefix, command, params } = parseIrcLine(line);

        switch (command) {
          /* ---- keep‑alive ---- */
          case 'PING':
            raw(`PONG :${params[0] || ''}`);
            break;

          /* ---- CAP negotiation (IRCv3) ---- */
          case 'CAP': {
            const sub = params[1];
            if (sub === 'LS') {
              // Wait for final LS line (non-multiline: params[2] is caps, not '*')
              if (params[2] !== '*') {
                raw('CAP REQ :message-tags server-time');
              }
            } else if (sub === 'ACK' || sub === 'NAK') {
              raw('CAP END');
            }
            break;
          }

          /* ---- registration complete ---- */
          case '001':
            registeredRef.current = true;
            setIsConnected(true);
            raw(`JOIN ${CHANNEL}`);
            break;

          /* ---- nick collision ---- */
          case '433': {
            const n = randomNick();
            nickRef.current = n;
            raw(`NICK ${n}`);
            break;
          }

          /* ---- JOIN ---- */
          case 'JOIN': {
            const { nick: jNick } = parsePrefix(prefix);
            const ch = (params[0] || '').replace(/^:/, '');
            if (ch !== CHANNEL) break;

            if (jNick === nickRef.current) {
              raw(`WHO ${CHANNEL}`);
              addMsg({
                type: 'system',
                nick: '',
                realname: '',
                text: 'Connected to chat.',
                timestamp: new Date(),
                isHighlight: false,
                isSelf: false,
              });
            } else {
              // Request realname for newcomer; delay join msg so WHO can arrive
              raw(`WHO ${jNick}`);
              setTimeout(() => {
                const rn = n2rRef.current.get(jNick) || jNick;
                addMsg({
                  type: 'join',
                  nick: jNick,
                  realname: rn,
                  text: '',
                  timestamp: new Date(),
                  isHighlight: false,
                  isSelf: false,
                });
                setMembers((prev) =>
                  prev.some((m) => m.nick === jNick)
                    ? prev
                    : [...prev, { nick: jNick, realname: rn, prefix: '' }],
                );
              }, 600);
            }
            break;
          }

          /* ---- PART ---- */
          case 'PART': {
            const { nick: pNick } = parsePrefix(prefix);
            if (pNick === nickRef.current) break;
            const rn = n2rRef.current.get(pNick) || pNick;
            addMsg({
              type: 'part',
              nick: pNick,
              realname: rn,
              text: params[1] || '',
              timestamp: new Date(),
              isHighlight: false,
              isSelf: false,
            });
            setMembers((prev) => prev.filter((m) => m.nick !== pNick));
            n2rRef.current.delete(pNick);
            break;
          }

          /* ---- QUIT ---- */
          case 'QUIT': {
            const { nick: qNick } = parsePrefix(prefix);
            if (qNick === nickRef.current) break;
            const rn = n2rRef.current.get(qNick) || qNick;
            addMsg({
              type: 'quit',
              nick: qNick,
              realname: rn,
              text: params[0] || '',
              timestamp: new Date(),
              isHighlight: false,
              isSelf: false,
            });
            setMembers((prev) => prev.filter((m) => m.nick !== qNick));
            n2rRef.current.delete(qNick);
            break;
          }

          /* ---- KICK ---- */
          case 'KICK': {
            const target = params[1];
            if (!target) break;
            const rn = n2rRef.current.get(target) || target;
            addMsg({
              type: 'part',
              nick: target,
              realname: rn,
              text: `Kicked: ${params[2] || ''}`,
              timestamp: new Date(),
              isHighlight: false,
              isSelf: false,
            });
            setMembers((prev) => prev.filter((m) => m.nick !== target));
            n2rRef.current.delete(target);
            if (target === nickRef.current) {
              setTimeout(() => raw(`JOIN ${CHANNEL}`), 3000);
            }
            break;
          }

          /* ---- NICK change ---- */
          case 'NICK': {
            const { nick: oldN } = parsePrefix(prefix);
            const newN = (params[0] || '').replace(/^:/, '');
            if (oldN === nickRef.current) nickRef.current = newN;
            const rn = n2rRef.current.get(oldN);
            if (rn) {
              n2rRef.current.delete(oldN);
              n2rRef.current.set(newN, rn);
            }
            setMembers((prev) =>
              prev.map((m) => (m.nick === oldN ? { ...m, nick: newN } : m)),
            );
            break;
          }

          /* ---- PRIVMSG ---- */
          case 'PRIVMSG': {
            const { nick: sNick } = parsePrefix(prefix);
            const target = params[0];
            const text = params[1] || '';
            if (target !== CHANNEL) break;
            if (sNick === nickRef.current) break; // we add our own locally

            const rn = n2rRef.current.get(sNick) || sNick;
            const rnLower = realnameRef.current.toLowerCase();
            const msgid = tags.msgid || undefined;
            const replyToMsgId = tags['+draft/reply'] || undefined;
            const serverTime = tags.time ? new Date(tags.time) : new Date();

            // CTCP ACTION
            if (text.startsWith('\x01ACTION ') && text.endsWith('\x01')) {
              const action = text.slice(8, -1);
              const hl = rnLower ? action.toLowerCase().includes(rnLower) : false;
              if (hl) onHighlight();
              addMsg({
                type: 'action',
                nick: sNick,
                realname: rn,
                text: action,
                timestamp: serverTime,
                isHighlight: hl,
                isSelf: false,
                msgid,
                replyToMsgId,
              });
            } else {
              const hl = rnLower ? text.toLowerCase().includes(rnLower) : false;
              if (hl) onHighlight();
              addMsg({
                type: 'message',
                nick: sNick,
                realname: rn,
                text,
                timestamp: serverTime,
                isHighlight: hl,
                isSelf: false,
                msgid,
                replyToMsgId,
              });
            }
            break;
          }

          /* ---- NOTICE — silently ignore ---- */
          case 'NOTICE':
            break;

          /* ---- WHO reply (352) ---- */
          case '352': {
            // :srv 352 <me> <ch> <user> <host> <server> <nick> <flags> :<hops> <realname>
            const whoNick = params[5];
            const trailing = params[7] || '';
            const si = trailing.indexOf(' ');
            const whoRn = si !== -1 ? trailing.substring(si + 1) : trailing;
            const flags = params[6] || '';

            if (whoNick && whoRn) n2rRef.current.set(whoNick, whoRn);

            let pfx = '';
            if (flags.includes('@')) pfx = '@';
            else if (flags.includes('+')) pfx = '+';

            setMembers((prev) => {
              const i = prev.findIndex((m) => m.nick === whoNick);
              const entry: IrcMember = {
                nick: whoNick,
                realname: whoRn || whoNick,
                prefix: pfx,
              };
              if (i !== -1) {
                const u = [...prev];
                u[i] = entry;
                return u;
              }
              return [...prev, entry];
            });
            break;
          }

          /* ---- NAMES reply (353) ---- */
          case '353': {
            const names = (params[params.length - 1] || '').split(' ').filter(Boolean);
            pendingNamesRef.current.push(...names);
            break;
          }

          /* ---- End of NAMES (366) ---- */
          case '366': {
            const nlist = pendingNamesRef.current;
            pendingNamesRef.current = [];
            const built: IrcMember[] = nlist.map((n) => {
              let pfx = '';
              let nk = n;
              if (/^[@+~&%]/.test(n)) {
                pfx = n[0];
                nk = n.substring(1);
              }
              return {
                nick: nk,
                realname: n2rRef.current.get(nk) || nk,
                prefix: pfx,
              };
            });
            setMembers(built);
            break;
          }

          /* ---- End of WHO (315) — refresh realnames ---- */
          case '315':
            setMembers((prev) =>
              prev.map((m) => ({
                ...m,
                realname: n2rRef.current.get(m.nick) || m.nick,
              })),
            );
            break;

          default:
            break;
        }
      }
    }

    connect();

    return () => {
      dead = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
    };
    // We intentionally depend only on the values that should trigger a reconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.displayName, user?.email, addMsg, onHighlight]);

  /* ---- provide ---- */
  return (
    <IrcContext.Provider
      value={{
        messages,
        members,
        isConnected,
        sendMessage,
        unreadMentions,
        clearUnreadMentions,
        myRealname,
        setChatOpen,
        highlightCounter,
      }}
    >
      {children}
    </IrcContext.Provider>
  );
}
