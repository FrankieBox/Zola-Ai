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

function chamarComLimite(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo limite excedido na resposta da IA.')), ms)
    ),
  ]);
}

async function gerarComRetry(prompt, tentativas = 2) {
  for (let i = 0; i < tentativas; i++) {
    try {
      return await chamarComLimite(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        }),
        12000
      );
    } catch (err) {
      const ehSobrecarga = err?.status === 503 || err?.code === 503;
      if (!ehSobrecarga || i === tentativas - 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt obrigatório.' });
    }

    const response = await gerarComRetry(prompt);
    res.json({ reply: response.text });
  } catch (error) {
    console.error('Erro na API Gemini:', error);
    res.status(500).json({ error: 'Erro ao processar a resposta da IA.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
a
