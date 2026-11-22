cat << 'EOF' > server.js
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = process.env.PORT || 3000;
const ai = new GoogleGenAI({});
const logPath = path.resolve("operacoes.txt");

app.use(express.json({ limit: "128kb" }));
app.use(express.static("public"));

function registrarLog(evento) {
  const linha = `[${new Date().toISOString()}] ${evento}\n`;
  fs.appendFile(logPath, linha, (err) => {
    if (err) console.error("Falha ao gravar log:", err.message);
  });
}

app.get("/api/status", (_req, res) => {
  res.json({
    online: true,
    chaveConfigurada: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/consulta", async (req, res) => {
  const inicio = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
      return res.status(400).json({ error: "O campo prompt é obrigatório." });
    }

    const historicoBruto = Array.isArray(req.body?.historico) ? req.body.historico : [];
    const contents = historicoBruto
      .filter((item) => item && (item.role === "user" || item.role === "model") && typeof item.text === "string" && item.text.trim())
      .slice(-10)
      .map((item) => ({
        role: item.role,
        parts: [{ text: item.text.trim() }],
      }));

    contents.push({
      role: "user",
      parts: [{ text: prompt }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
    });

    const duracaoMs = Date.now() - inicio;
    registrarLog(`POST /api/consulta | status=200 | duracao=${duracaoMs}ms | chars=${prompt.length}`);

    return res.json({
      resposta: response.text ?? "",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const duracaoMs = Date.now() - inicio;
    registrarLog(`POST /api/consulta | status=502 | duracao=${duracaoMs}ms | erro=${err.message}`);
    console.error("Erro na consulta Gemini:", err);
    return res.status(502).json({ error: "Falha ao consultar o modelo Gemini." });
  }
});

app.listen(port, () => {
  registrarLog(`SERVIDOR INICIADO | porta=${port}`);
  console.log(`Servidor rodando em http://localhost:${port}`);
});
EOF
