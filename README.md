# Mechahouse Mobile

This project has an Expo 57 app shell and the first test-driven slice of a pure TypeScript simulation coordinator. The shell only displays the project name. Jotai is installed for later application state integration but is not used by the simulation.

## Run and check

Use Node 22.13 or newer and npm. `package-lock.json` is committed; use `npm ci` for a clean install.

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npx expo start
```
