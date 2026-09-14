# Conta Lanche

Aplicativo pessoal para registrar lanches comprados de colegas, acompanhar pagamentos e exportar relatórios. O projeto não possui backend: os dados ficam no SQLite e as imagens na pasta privada do aplicativo.

## Requisitos

- Node.js 22.13 ou superior;
- npm;
- Para executar no Android: Android Studio/SDK ou um aparelho com Expo Go compatível com o SDK do projeto;
- Para gerar APK na nuvem: conta Expo/EAS.

## Instalação e execução

```bash
npm install
npx expo install --check
npm run start
```

No terminal do Expo, pressione `a` para abrir um emulador Android ou leia o QR code com o Expo Go compatível. A câmera, o SQLite e o seletor de arquivos precisam ser exercitados em um aparelho/emulador; o navegador não substitui esses recursos nativos.

## APK Android de teste

O perfil `preview` em `eas.json` gera um APK de distribuição interna:

```bash
npx eas-cli build --platform android --profile preview
```

Entre na sua conta Expo se o EAS solicitar. O APK final ficará disponível no link apresentado ao final do build. Para executar diretamente com Android Studio conectado, também é possível usar `npm run android`.

## Verificações

```bash
npm run typecheck
npm run lint
npm test
```

Os testes de unidade cobrem conversão de reais para centavos, quinto dia útil e feriados nacionais, filtros, totais, agrupamento por vendedor e formação dos lotes de pagamento. A persistência e os recursos nativos devem ser conferidos em um build Android, pois dependem do runtime Expo/SQLite e do armazenamento do aparelho.

## Estrutura

- `app/`: rotas, telas e navegação inferior com Expo Router;
- `src/db/`: abertura do SQLite, migrações e repositório;
- `src/services/`: centavos, calendário, filtros, pagamentos, fotos e exportação/backup;
- `src/components/`: componentes visuais reutilizáveis;
- `src/__tests__/`: testes das regras puras.

O schema começa na versão 1 e usa `PRAGMA user_version` para aplicar migrações. Fotos são redimensionadas/comprimidas e copiadas para uma pasta persistente antes da compra ser gravada. Compras pagas continuam no histórico; pagamentos em lote têm seus vínculos próprios.

## Decisões do MVP

- A data é digitada no formato brasileiro `DD/MM/AAAA` e armazenada no banco em ISO `AAAA-MM-DD`.
- O calendário inclui feriados nacionais fixos e a Paixão de Cristo. Feriados estaduais/municipais e dias sem expediente podem ser adicionados em Ajustes. Um feriado nacional pode ser removido da lista para tratá-lo como dia útil.
- O backup é um arquivo ZIP validado com uma cópia lógica dos registros, vínculos de pagamento, ajustes, feriados e imagens; a restauração substitui os dados locais após confirmação.
- A restauração e o banco não usam criptografia adicional. Mantenha o arquivo de backup em local confiável.
- Não há sincronização entre aparelhos nem conta de usuário nesta versão.
