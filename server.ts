import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitização rigorosa das credenciais (limpa espaços, quebras de linha e aspas acidentais)
const rawToken = process.env.NOTION_TOKEN || "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";
const rawDbId = process.env.NOTION_DATABASE_ID || "33ca22b7-07fd-8040-9e66-dcfa4595b537";

const NOTION_TOKEN = rawToken.replace(/[\s"']/g, '').trim();
let NOTION_DATABASE_ID = rawDbId.replace(/[\s"']/g, '').trim();

// Garantir formato com hifens para o ID do banco se for um ID de 32 caracteres sem hifens
if (NOTION_DATABASE_ID.length === 32 && !NOTION_DATABASE_ID.includes('-')) {
  NOTION_DATABASE_ID = NOTION_DATABASE_ID.replace(
    /^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i,
    '$1-$2-$3-$4-$5'
  );
}

console.log("--- ✅ NOTION CONFIG READY ---");
console.log("Token Prefix:", NOTION_TOKEN.substring(0, 15) + "...");
console.log("Database ID:", NOTION_DATABASE_ID);
console.log("Token Length:", NOTION_TOKEN.length);
console.log("------------------------------");
const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Middleware para injetar o Token do Notion em todas as chamadas
  const notionHeaders = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };

  // API Routes
  
  // Query Database
  app.post("/api/notion/query", async (req, res) => {
    try {
      const response = await fetch(`${NOTION_API_URL}/databases/${NOTION_DATABASE_ID}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("FULL NOTION ERROR:", JSON.stringify(data, null, 2));
        return res.status(response.status).json(data); // Retorna o objeto de erro completo
      }
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ message: "Erro ao consultar Notion", error: error.message });
    }
  });

  // Get Database Schema
  app.get("/api/notion/database", async (req, res) => {
    try {
      const response = await fetch(`${NOTION_API_URL}/databases/${NOTION_DATABASE_ID}`, {
        method: 'GET',
        headers: notionHeaders
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("FULL NOTION ERROR (DB):", JSON.stringify(data, null, 2));
        return res.status(response.status).json({ 
          message: data.message || "Erro na API do Notion", 
          code: data.code,
          status: response.status 
        });
      }
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar esquema do Notion", error: error.message });
    }
  });

  // Create Page
  app.post("/api/notion/pages", async (req, res) => {
    try {
      const body = req.body;
      if (body.parent && body.parent.database_id === "DATABASE_ID_HANDLED_BY_SERVER") {
        body.parent.database_id = NOTION_DATABASE_ID;
      }
      const response = await fetch(`${NOTION_API_URL}/pages`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify(body)
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar página no Notion", error: error.message });
    }
  });

  // Update Page (Patch)
  app.patch("/api/notion/pages/:id", async (req, res) => {
    try {
      const response = await fetch(`${NOTION_API_URL}/pages/${req.params.id}`, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar página no Notion", error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
