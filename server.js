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

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function comTimeout(promessa, ms = 25000) {
  return Promise.race([
    promessa,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tempo limite excedido.')), ms)
    ),
  ]);
}

async function gerarRespostaIA(prompt) {
  const maxTentativas = 2;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    try {
      const resposta = await comTimeout(
        ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        }),
        25000
      );
      return resposta.text;
    } catch (err) {
      const status = err?.status || err?.code;
      if (status === 429) {
        const erroCota = new Error('Limite de requisições da cota gratuita atingido.');
        erroCota.statusCode = 429;
        throw erroCota;
      }
      if (status === 503 && tentativa < maxTentativas - 1) {
        await aguardar(1500 * (tentativa + 1));
        continue;
      }
      throw err;
    }
  }
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
    });
    if (error?.statusCode === 429) {
      return res.status(429).json({ error: 'Limite diário de uso da IA atingido.' });
    }
    return res.status(500).json({ error: 'Erro ao processar a resposta da IA.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
