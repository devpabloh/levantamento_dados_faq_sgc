import { FormEvent, useMemo, useState } from "react";
import { sendMessage } from "../lib/chatApi";

type messageFrom = "user" | "bot"

interface message {
    from: messageFrom;
    text: string;
    confidence?: number;
}

export default function ChatWidget(){
 const [input, setInput] = useState("");
 const [loading, setLoading] = useState(false)
 const [messages, setMessages] = useState<message[]>([
    {
        from: "bot",
        text: "Olá! Eu sou a Júlia, sua assistente virtual. Em que posso te ajudar hoje?"
    }
 ])

 const userId = useMemo(()=>{
    const key = "chat_user_id";
    let v = localStorage.getItem(key)
    
    if(!v){
        v = `web_${crypto.randomUUID()}`;
        localStorage.setItem(key, v)
    }
    return v
 }, [])

 async function onSend(e: FormEvent){
    e.preventDefault()

    const text = input.trim();

    if(!text || loading) return

    setMessages((prev) => [...prev, {from: "user", text}])
    setInput("")
    setLoading(true)

    try {
      const data = await sendMessage({ user_id: userId, message: text }, "telegram");
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: data.response, confidence: data.confidence },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "Nao consegui conectar ao servidor agora." },
      ]);
    } finally {
      setLoading(false);
    }
 }
 return (
     <div className="mx-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-sm">

      <div className="h-60 md:h-96 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={[
                "max-w-[95%] rounded-2xl px-3 py-2 text-sm",
                m.from === "user"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-800",
              ].join(" ")}
            >
              <p>{m.text}</p>
              {m.from === "bot" && typeof m.confidence === "number" && (
                <p className="mt-1 text-xs text-slate-500">
                  confianca: {(m.confidence * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && <p className="text-sm text-slate-500">Digitando...</p>}
      </div>

      <form onSubmit={onSend} className="flex gap-2 border-t border-slate-200 p-3 bg-indigo-500">
        <input
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 bg-white"
          placeholder="Digite sua pergunta..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 cursor-pointer"
        >
          Enviar
        </button>
      </form>
    </div>
 )
}