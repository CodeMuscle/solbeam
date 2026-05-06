interface Props {
  botToken: string
  chatId: string
  onChangeBotToken: (value: string) => void
  onChangeChatId: (value: string) => void
}

export function TelegramConfig({ botToken, chatId, onChangeBotToken, onChangeChatId }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[#555] text-xs mb-1">Bot Token</label>
        <input
          type="password"
          value={botToken}
          onChange={(e) => onChangeBotToken(e.target.value)}
          placeholder="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333] font-mono"
        />
      </div>
      <div>
        <label className="block text-[#555] text-xs mb-1">Chat ID</label>
        <input
          type="text"
          value={chatId}
          onChange={(e) => onChangeChatId(e.target.value)}
          placeholder="-100123456789 or @channelname"
          className="w-full bg-[#111] border border-[#1e1e1e] text-[#ccc] text-xs rounded px-3 py-2 outline-none focus:border-[#2a2a2a] placeholder-[#333] font-mono"
        />
      </div>
      <p className="text-[#333] text-xs">
        Create a bot via @BotFather → get token. Message the bot, then call
        api.telegram.org/bot&lt;token&gt;/getUpdates to find your chat ID.
      </p>
    </div>
  )
}
