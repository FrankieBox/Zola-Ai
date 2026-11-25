import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function gerarRespostaIA(prompt) {
  const resposta = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: prompt,
  });
  return resposta.text;
}

app.post('/api/chat', async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    if (!prompt) {
      return res.status(400).json({ error: 'Digite uma mensagem antes de enviar.' });
    }

    const reply = await gerarRespostaIA(prompt);
    return res.json({ reply: reply || 'Sem resposta no momento.' });
  } catch (error) {
    console.error('Erro na API Gemini:', {
      message: error?.message,
      status: error?.status || error?.statusCode,
      code: error?.code,
      details: error?.details || error?.errorDetails,
    });
    if (error?.status === 429 || error?.statusCode === 429 || error?.code === 429) {
      return res.status(429).json({ error: 'Limite diário de uso da IA atingido.' });
    }
    return res.status(500).json({ error: 'Erro ao processar a resposta da IA.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
a
