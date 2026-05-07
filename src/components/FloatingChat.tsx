import { useState } from "react";
import ChatWidget from "./ChatWidget";
import lisleft from "../assets/julia.png"
import juliaMostrandoIcon from "../assets/julia_mostrar_chat.png";



export default function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-3 right-2 z-50 h-45 w-55 overflow-hidden hover:cursor-pointer"
        aria-label={open ? "Fechar chat" : "Abrir chat"}
        >
        {open ? (
            <img
            src={juliaMostrandoIcon}
            alt="Abrir chat"
            className="h-full w-full object-cover"
            />
        ) : (
            <img
            src={lisleft}
            alt="Abrir chat"
            className="h-full w-full object-cover"
            />
        )}
        </button>

      {open && (
        <div className="fixed bottom-35 right-40 z-50 w-[92vw] max-w-md">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-indigo-500 shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold text-white-800 ">Assistente virtual do SGC</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-white-600 hover:bg-slate-100 "
              >
                X
              </button>
            </div>

            <ChatWidget />
          </div>
        </div>
      )}
    </>
  );
}