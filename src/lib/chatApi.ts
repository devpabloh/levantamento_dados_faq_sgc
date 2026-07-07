export interface chatbotRequest {
    user_id: string;
    message: string;
}

export interface chatbotResponse {
    response: string;
    confidence: number;
    tag: string
    sucess: boolean;
}

export type channel = "telegram" | "whatsapp"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const ORIGIN = import.meta.env.VITE_ORIGIN;

export async function sendMessage(payload: chatbotRequest, channel: channel = "telegram"):Promise<chatbotResponse>{

    const res = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
            "Content-type": "application/json",
            "Origin": "https://levantamento-dados-faq-sgc.vercel.app"
        },
        body: JSON.stringify(payload)
    })

    if(!res.ok){
        throw new Error(`Erro HTTP ${res.status}`)
    }

    return res.json() as Promise<chatbotResponse>
}