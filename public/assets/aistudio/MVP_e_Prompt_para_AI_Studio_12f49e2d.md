# MVP - Caça ao Tesouro Urbano (Frota de Veículos)

Este documento registra a especificação oficial do **MVP (Minimum Viable Product)** da nossa aplicação de caça ao tesouro em ruas reais, bem como o prompt estruturado para gerar ou expandir o projeto no Google AI Studio.

---

## 1. Resumo da Arquitetura do MVP

* **Tecnologia Base:** HTML5, Tailwind CSS e Leaflet.js (OpenStreetMap / CartoDB Voyager) — zero custo de API e sem necessidade de chave de acesso.
* **Epicentro Inicial:** CEU Butantã (`Av. Eng. Heitor Antônio Eiras Garcia, 1870 - Jardim Esmeralda, São Paulo - SP`, Coordenadas: `-23.5878, -46.7525`).
* **Perímetro Dinâmico:** Raio configurável pelo Admin (padrão inicial: `2 km`), aplicando círculo visual pontilhado no mapa e trava física de navegação (`maxBounds`).
* **Catálogo de Veículos (CRUD Completo):**
  * **Polícia:** Polícia Militar (PM), Guarda Civil Metropolitana (GCM), Polícia Civil.
  * **Bombeiros:** Auto-Bomba (Caminhão), Unidade de Resgate, Auto-Escada.
  * **Ambulância:** SAMU 192, UTI Móvel, Ambulância de Resgate.
  * **Serviços Urbanos:** Energia (Enel), Telecom/Internet (Claro / Vivo).
  * **Veículos Comuns:** Moto Urbana, Carro Comum (Prata/Branco), Carro Comum (Vermelho/Azul).
* **Cronômetro de Pista:** Contagem progressiva em tempo real a partir do momento em que o veículo é marcado na rua (`Encontrado há Xm Ys`), estacionando em **`20 minutos +`** após completar 1.200 segundos.
* **Camada de Dados (`DataService`):** Isolada usando `localStorage` no MVP, preparada para substituição direta pelos métodos `onSnapshot`, `addDoc`, `updateDoc` e `deleteDoc` do Firebase Firestore.

---

## 2. Prompt Pronto para Copiar e Colar no AI Studio

> **Dica:** Você pode simplesmente copiar o texto abaixo e colar no Google AI Studio (ou Claude / Bolt.new) caso queira gerar uma versão em React ou pedir novas evoluções.

```text
Atue como um Engenheiro de Software Sênior. Crie uma aplicação web completa e responsiva (estilo mobile-first para uso na rua via celular) chamada "Radar da Caça - Frota Urbana", funcionando como um mapa de GPS real para uma caça ao tesouro infantil.

### REQUISITOS TÉCNICOS E ARQUITETURA:
1. **Stack:** Single-file HTML com Tailwind CSS via CDN e Leaflet.js (usando tiles limpos estilo GPS do CartoDB Voyager ou OpenStreetMap).
2. **Camada de Dados Isolada (`DataService`):** Centralize todas as operações de leitura, gravação, edição e exclusão em um objeto `DataService` usando `localStorage`, estruturado de forma assíncrona/modular para que eu possa substituir facilmente pelo Firebase Firestore (usando `onSnapshot`) na próxima etapa.

### FUNCIONALIDADES DO MAPA (TELA PRINCIPAL):
1. **Perímetro Dinâmico e Trava de Área:**
   - O ponto central padrão deve ser o CEU Butantã, São Paulo (-23.5878, -46.7525) com raio padrão de 2 km.
   - Desenhe um círculo pontilhado no mapa mostrando o limite da área de jogo e aplique `map.setMaxBounds()` dinamicamente com base no centro e raio configurados, impedindo que o usuário arraste o mapa para fora da área da brincadeira.
   - Inclua um botão flutuante de "Minha Localização (GPS)" usando `navigator.geolocation`.
2. **Marcação de Veículos na Rua:**
   - Ao clicar/tocar em qualquer ponto dentro da área permitida do mapa, abra um modal/gaveta rápida exibindo os veículos cadastrados (agrupados ou filtráveis por categoria) para fixar naquela coordenada exata.
3. **Marcadores Customizados e Cronômetro:**
   - Cada pino no mapa deve exibir o ícone ilustrado/animado (SVG) ou a foto real do veículo marcado.
   - Ao tocar no pino, abra um balão (Popup) mostrando: imagem/ícone, nome do veículo, categoria e um cronômetro ao vivo ("Encontrado há X min Y seg").
   - Quando o tempo atingir 20 minutos (1200 segundos), o cronômetro deve parar de contar e exibir fixo: **"20 minutos +"**.

### PAINEL DE ADMINISTRAÇÃO (SEM SENHA PARA TESTES):
Crie uma aba/botão no topo para alternar instantaneamente entre "Mapa GPS" e "Administração" (acesso direto, sem login). Na Administração, implemente:
1. **Configuração da Área de Jogo:**
   - Campos para alterar Latitude, Longitude e Raio em KM (ex: 1 km, 2 km, 5 km, 15 km).
   - Botão para buscar endereço via API gratuita Nominatim (OpenStreetMap) para atualizar o centro automaticamente, além de botão "Usar meu GPS atual como centro" e clique em um mini-mapa de ajuste.
2. **Catálogo de Veículos (CRUD Completo - Adicionar, Editar e Excluir):**
   - Já venha pré-populado na primeira execução com ícones SVG estilizados para:
     - Polícia: Polícia Militar (PM), GCM, Polícia Civil.
     - Bombeiros: Caminhão Auto-Bomba, Resgate Bombeiros, Auto-Escada.
     - Ambulância: SAMU, UTI Móvel, Resgate Básico.
     - Serviços: Energia (Enel), Internet (Claro), Internet (Vivo).
     - Comuns: Moto, Carro Passeio (Branco/Prata), Carro Passeio (Colorido).
   - Formulário para **Adicionar novo veículo** ou **Editar existente**, permitindo escolher um ícone SVG padrão OU fazer upload de foto real (convertida para Base64/DataURL redimensionada via Canvas para não pesar o armazenamento).
   - Botão de **Excluir** em cada veículo do catálogo.
3. **Gerenciamento de Marcações Ativas:**
   - Lista de todos os veículos atualmente marcados no mapa com horário de registro e botão individual para excluir a marcação, além de botão "Limpar todas as marcações do mapa".
```