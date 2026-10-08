# FPS Mobile Multiplayer

Jogo de tiro 3D em primeira pessoa para navegador (Three.js) com multiplayer online (Node.js + Socket.IO).

## Estrutura
- `server.js` – servidor do jogo (salas, tiros, dano, placar)
- `package.json` – dependências
- `public/index.html` – o jogo (cliente)
- `render.yaml` – configuração automática da hospedagem (Render)

## Publicar (só com o celular Android)
1. Crie conta grátis em github.com (Chrome → menu ⋮ → "Site para computador").
2. Crie um repositório novo (público ou privado).
3. Envie os arquivos: **Add file → Create new file**. Em "Name", digite o caminho e cole o conteúdo:
   - `server.js`
   - `package.json`
   - `render.yaml`
   - `.gitignore`
   - `public/index.html` (digitar a barra cria a pasta `public` sozinha)
   Toque em **Commit changes** a cada arquivo.
4. Crie conta em render.com (entrar com GitHub).
5. **New → Blueprint** (usa o `render.yaml`) e escolha o repositório. Se preferir manual: New → Web Service, Build `npm install`, Start `node server.js`, plano Free.
6. Aguarde o deploy. O link aparece no topo (`https://....onrender.com`).

## Testar
- Celular A: abra o link → nome → **Criar sala** → toque no código do topo para compartilhar.
- Celular B (outra rede): abra o link → nome → código → **Entrar em sala**.
- Verifique: o outro jogador aparece, tiros causam dano, placar e respawn funcionam.
- Teste local no PC: `npm install && npm start` e abra http://localhost:3000

## Limitações do plano grátis
- Dorme após ~15 min sem uso; primeiro acesso demora cerca de 1 min.
- Poucos recursos: ideal para grupos pequenos.
- Salas ficam em memória e somem se o servidor reiniciar.
- Sem chaves secretas: nada sensível no código.
