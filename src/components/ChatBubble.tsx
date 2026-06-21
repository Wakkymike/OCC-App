'use client';

import React, { useState, useEffect, useRef, type ReactElement } from 'react';
import { useIrc, initAudio, type IrcMessage } from '@/contexts/irc-context';
import { useAuth } from '@/contexts/auth-context';
import { MessageCircle, X, Users, Send, ArrowLeft, Smile, Reply } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Render text with highlighted occurrences of `hl` wrapped in <mark>. */
function renderHighlightedText(text: string, hl: string): ReactElement | string {
  if (!hl) return text;
  const regex = new RegExp(`(${escapeRegex(hl)})`, 'gi');
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === hl.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-300 dark:bg-yellow-600 text-foreground rounded-sm px-0.5"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function prefixOrder(p: string) {
  return p === '~' ? 0 : p === '&' ? 1 : p === '@' ? 2 : p === '%' ? 3 : p === '+' ? 4 : 5;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatBubble() {
  const { user } = useAuth();
  const irc = useIrc();

  const [isOpen, setIsOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [input, setInput] = useState('');
  const [isFlashing, setIsFlashing] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);
  const [replyingTo, setReplyingTo] = useState<IrcMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevHighlight = useRef(0);

  /* auto‑scroll on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [irc.messages]);

  /* track whether the chat window is open (for badge logic) */
  useEffect(() => {
    irc.setChatOpen(isOpen);
    if (isOpen) {
      irc.clearUnreadMentions();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, irc]);

  /* close emoji picker on outside click */
  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmoji]);

  /* flash on highlight */
  useEffect(() => {
    if (irc.highlightCounter > 0 && irc.highlightCounter !== prevHighlight.current) {
      prevHighlight.current = irc.highlightCounter;
      setIsFlashing(true);
      const t = setTimeout(() => setIsFlashing(false), 2000);
      return () => clearTimeout(t);
    }
  }, [irc.highlightCounter]);

  /* don't render when logged out */
  if (!user) return null;

  /* ---- handlers ---- */

  const handleBubbleClick = () => {
    initAudio(); // unlock AudioContext on first gesture
    setIsOpen((o) => !o);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    irc.sendMessage(input, replyingTo?.msgid ?? replyingTo?.id);
    setInput('');
    setReplyingTo(null);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      if (replyingTo) setReplyingTo(null);
      else if (showEmoji) setShowEmoji(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  /* ---- Emoji data ---- */
  const seg = (s: string) => [...new Intl.Segmenter().segment(s)].map((x) => x.segment);
  const emojiCategories = [
    { label: '😀', name: 'Smileys', emojis: seg('😀😃😄😁😆😅🤣😂🙂😉😊😇🥰😍🤩😘😗😚😋😛😜🤪😝🤑🤗🤭🤫🤔🫣🤐😐😑😶🫥😏😒🙄😬🤥🫠😌😔😪🤤😴😷🤒🤕🤢🤮🥴😵🤯🥳🥸😎🤓🧐😕🫤😟🙁😮😯😲😳🥺🥹😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬') },
    { label: '👋', name: 'People', emojis: seg('👋🤚🖐️✋🖖🫱🫲👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆🖕👇☝️🫵👍👎✊👊🤛🤜👏🙌🫶👐🤝🙏💪🦵🦶👂🦻👃👶🧒👦👧🧑👩👨🧓👴👵') },
    { label: '🐶', name: 'Animals', emojis: seg('🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🦆🦅🦉🦇🐺🐗🐴🦄🐝🪱🐛🦋🐌🐞🐜🪰🪲🐢🐍🦎🦂🦀🦑🐙🦞🐠🐟🐡🐬🦈🐳🐋🐊') },
    { label: '🍎', name: 'Food', emojis: seg('🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🌽🌶️🌮🍕🍔🍟🌭🥪🌯🧆🥗🥘🍝🍜🍲🍛🍣🍱🥟🍤🍙🍘🍡🥮🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍩🍪☕🍵🧋🥤🍺🍻🥂🍷') },
    { label: '🚗', name: 'Travel', emojis: seg('🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🛻🚚🚛🚜🛵🏍️🚲🛴🚏🛞🚨🚥🛑⛽🗺️🧭⛵🛳️🚢✈️🛩️🚀🛸🛫🛬🪂🚁🚠🚡🚂🚃🚄🚅🚆🚇🚈🚉🏠🏡⛺🌄🌅🌇🌆🏙️🌃') },
    { label: '⚽', name: 'Activities', emojis: seg('⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🏓🏸🥅🏒🏑🥍🏏⛳🏹🎣🤿🥊🥋🎽⛸️🥌🛷🎿⛷️🏂🏋️🤸🤺🤾⛹️🏌️🏇🧘🏄🏊🤽🚣🧗🚵🚴🏆🥇🥈🥉🏅🎖️🎗️🎪🎭🎨🎬') },
    { label: '💡', name: 'Objects', emojis: seg('💡🔦🏮📱💻⌨️🖥️🖨️📷📹🎥📞☎️📺📻🎙️🎧🎤🎵🎶🔔🔕📯🔇🔈🔉🔊💰💳🔑🔒🔓🗑️🔧🔨🛠️🧲🔫🧨💣🪓🔪⚔️🛡️🚬⚰️🧿🪬❤️🧡💛💚💙💜🤎🖤🤍') },
    { label: '🚩', name: 'Symbols', emojis: seg('❤️🧡💛💚💙💜🤎🖤🤍💔❣️💕💞💓💗💖💝✅❌❓❗⭐🔥💯🎉🎊💤💢💥🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛🔴🟠🟡🟢🔵🟣🟤⚫⚪🟥🟧🟨🟩🟦🟪🟫⬛⬜♠️♥️♦️♣️🏳️🏴🚩') },
  ];

  /* ---- render a single message row ---- */

  const renderMsg = (msg: IrcMessage) => {
    const t = formatTime(msg.timestamp);

    switch (msg.type) {
      case 'system':
      case 'notice':
        return (
          <div key={msg.id} className="text-xs text-muted-foreground italic px-3 py-0.5">
            <span className="opacity-60 mr-1">{t}</span>
            {msg.text}
          </div>
        );

      case 'join':
        return (
          <div key={msg.id} className="text-xs text-green-600 dark:text-green-400 px-3 py-0.5">
            <span className="opacity-60 mr-1">{t}</span>→{' '}
            <span className="font-medium">{msg.realname}</span> joined
          </div>
        );

      case 'part':
        return (
          <div key={msg.id} className="text-xs text-orange-600 dark:text-orange-400 px-3 py-0.5">
            <span className="opacity-60 mr-1">{t}</span>←{' '}
            <span className="font-medium">{msg.realname}</span> left
            {msg.text ? ` (${msg.text})` : ''}
          </div>
        );

      case 'quit':
        return (
          <div key={msg.id} className="text-xs text-red-500 dark:text-red-400 px-3 py-0.5">
            <span className="opacity-60 mr-1">{t}</span>←{' '}
            <span className="font-medium">{msg.realname}</span> disconnected
          </div>
        );

      case 'action': {
        const actionParent = msg.replyToMsgId
          ? irc.messages.find((m) => m.msgid === msg.replyToMsgId || m.id === msg.replyToMsgId)
          : undefined;
        return (
          <div
            key={msg.id}
            className={`group relative text-sm px-3 py-0.5 hover:bg-muted/30 ${msg.isHighlight ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}
          >
            {actionParent && (
              <div className="text-xs text-muted-foreground pl-3 border-l-2 border-muted-foreground/30 mb-0.5 truncate">
                <span className="font-medium">{actionParent.realname}</span>: {actionParent.text}
              </div>
            )}
            <span className="text-xs text-muted-foreground opacity-60 mr-1">{t}</span>
            <span className="italic">
              *{' '}
              <span className={`font-medium ${msg.isSelf ? 'text-primary' : ''}`}>
                {msg.realname}
              </span>{' '}
              {renderHighlightedText(msg.text, irc.myRealname)}
            </span>
            <button
              onClick={() => { setReplyingTo(msg); setShowEmoji(false); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="absolute right-1 top-0.5 hidden group-hover:inline-flex p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }

      case 'message':
      default: {
        const msgParent = msg.replyToMsgId
          ? irc.messages.find((m) => m.msgid === msg.replyToMsgId || m.id === msg.replyToMsgId)
          : undefined;
        return (
          <div
            key={msg.id}
            className={`group relative text-sm px-3 py-0.5 hover:bg-muted/30 ${msg.isHighlight ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}
          >
            {msgParent && (
              <div className="text-xs text-muted-foreground pl-3 border-l-2 border-muted-foreground/30 mb-0.5 truncate">
                <span className="font-medium">{msgParent.realname}</span>: {msgParent.text}
              </div>
            )}
            <span className="text-xs text-muted-foreground opacity-60 mr-1">{t}</span>
            <span className={`font-semibold ${msg.isSelf ? 'text-primary' : ''}`}>
              {msg.realname}
            </span>
            <span className="mx-0.5">:</span>
            <span className="break-words">
              {renderHighlightedText(msg.text, irc.myRealname)}
            </span>
            <button
              onClick={() => { setReplyingTo(msg); setShowEmoji(false); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="absolute right-1 top-0.5 hidden group-hover:inline-flex p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Reply"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
    }
  };

  /* ---- sorted members ---- */
  const sortedMembers = [...irc.members].sort(
    (a, b) => prefixOrder(a.prefix) - prefixOrder(b.prefix) || a.realname.localeCompare(b.realname),
  );

  /* ---- render ---- */
  return (
    <>
      {/* -------- Chat window -------- */}
      {isOpen && (
        <div className="fixed bottom-[5.5rem] right-4 z-50 w-[calc(100vw-2rem)] sm:w-[380px] h-[500px] max-h-[calc(100vh-7rem)] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-primary text-primary-foreground shrink-0">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${irc.isConnected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <h3 className="font-semibold text-sm">{showMembers ? 'Members' : 'Chat'}</h3>
            </div>

            <div className="flex items-center gap-0.5">
              {!showMembers ? (
                <button
                  onClick={() => setShowMembers(true)}
                  className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                  title="Members"
                >
                  <Users className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowMembers(false)}
                  className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                  title="Back to chat"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md hover:bg-primary-foreground/20 transition-colors"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {showMembers ? (
            /* ---- Members list ---- */
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-xs text-muted-foreground mb-2">
                {sortedMembers.length} member{sortedMembers.length !== 1 ? 's' : ''} online
              </div>
              {sortedMembers.map((m) => (
                <div
                  key={m.nick}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      m.prefix === '@' || m.prefix === '~' || m.prefix === '&'
                        ? 'bg-yellow-500'
                        : m.prefix === '+' || m.prefix === '%'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                    }`}
                  />
                  <span className="truncate">{m.realname}</span>
                </div>
              ))}
            </div>
          ) : (
            /* ---- Messages ---- */
            <>
              <div className="flex-1 overflow-y-auto">
                {irc.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    {irc.isConnected ? 'No messages yet.' : 'Connecting…'}
                  </div>
                ) : (
                  <div className="py-1.5">
                    {irc.messages.map(renderMsg)}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Reply preview */}
              {replyingTo && (
                <div className="border-t px-3 py-1.5 flex items-center gap-2 text-xs bg-muted/40 shrink-0">
                  <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 truncate text-muted-foreground">
                    <span className="font-medium text-foreground">{replyingTo.realname}</span>: {replyingTo.text}
                  </div>
                  <button
                    onClick={() => { setReplyingTo(null); inputRef.current?.focus(); }}
                    className="shrink-0 p-0.5 rounded hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmoji && (
                <div
                  ref={emojiRef}
                  className="border-t bg-background flex flex-col shrink-0"
                  style={{ height: 200 }}
                >
                  {/* category tabs */}
                  <div className="flex border-b px-1 py-1 gap-0.5 overflow-x-auto shrink-0">
                    {emojiCategories.map((cat, i) => (
                      <button
                        key={cat.name}
                        onClick={() => setEmojiCat(i)}
                        className={`text-base px-1.5 py-0.5 rounded-md transition-colors ${
                          emojiCat === i ? 'bg-muted' : 'hover:bg-muted/50'
                        }`}
                        title={cat.name}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  {/* emoji grid */}
                  <div className="flex-1 overflow-y-auto p-1">
                    <div className="grid grid-cols-8 gap-0.5">
                      {emojiCategories[emojiCat].emojis.map((emoji, i) => (
                        <button
                          key={`${emoji}-${i}`}
                          onClick={() => insertEmoji(emoji)}
                          className="text-xl h-8 w-8 flex items-center justify-center rounded hover:bg-muted/70 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Input bar */}
              <div className="border-t p-2 flex gap-1.5 shrink-0">
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  className={`shrink-0 p-1.5 rounded-md transition-colors ${
                    showEmoji
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  title="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={irc.isConnected ? 'Type a message…' : 'Connecting…'}
                  disabled={!irc.isConnected}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!irc.isConnected || !input.trim()}
                  className="shrink-0 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* -------- Bubble button -------- */}
      <button
        onClick={handleBubbleClick}
        className={`fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
          isFlashing ? 'chat-flash-ring' : ''
        }`}
        title="Chat"
      >
        <MessageCircle className="h-6 w-6" />

        {/* Unread badge */}
        {irc.unreadMentions > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold leading-none rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow">
            {irc.unreadMentions > 99 ? '99+' : irc.unreadMentions}
          </span>
        )}
      </button>
    </>
  );
}
