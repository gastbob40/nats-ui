# NATS Test Scripts

Ce dossier contient des scripts de test pour valider le fonctionnement de NATS et tester l'interface.

## Scripts

### `server.js`
Serveur de test qui publie des messages sur les sujets :
- `users.new` : Nouveau utilisateur créé (toutes les 2 secondes)
- `users.update` : Utilisateur mis à jour (tous les 4 secondes)

### `client.js`
Client de test qui écoute les deux sujets et affiche les messages reçus.

### `create-stream.js`
Script qui crée un stream JetStream "USERS" pour capturer les messages `users.*`.

### `create-consumers.js`
Script qui crée plusieurs consumers JetStream pour tester différentes configurations :
- `user-processor` : Traite tous les événements utilisateur avec sujet de livraison
- `user-auditor` : Audit des nouveaux événements utilisateur 
- `user-analytics` : Consumer analytics pour l'enregistrement utilisateur (fire-and-forget)

## Utilisation

### Prérequis
1. Serveur NATS **avec JetStream** activé : `nats-server -js -p 4222`
2. Dépendances installées depuis la racine du projet : `pnpm install` (les scripts utilisent `@nats-io/transport-node` et `@nats-io/jetstream`)

### Configuration initiale

**Créer le stream JetStream (une seule fois) :**
```bash
cd tests
node create-stream.js
```

Cela créera un stream "USERS" qui capturera tous les messages `users.*` dans JetStream.

**Créer les consumers JetStream (optionnel) :**
```bash
cd tests
node create-consumers.js
```

Cela créera 3 consumers différents pour tester diverses configurations JetStream.

### Lancement

**Terminal 1 - Serveur :**
```bash
cd tests
node server.js
```

**Terminal 2 - Client :**
```bash
cd tests
node client.js
```

### Ce que vous devriez voir

**Serveur :**
```
✅ NATS Server connected
📡 Publishing messages to users.new and users.update every 2 seconds...
📤 Published to users.new: { id: 1, name: 'User 1', ... }
📤 Published to users.new: { id: 2, name: 'User 2', ... }
📤 Published to users.update: { id: 1, name: 'Updated User 1', ... }
```

**Client :**
```
✅ NATS Client connected
👂 Listening to users.new and users.update...

🆕 [users.new #1] Received: { id: 1, name: 'User 1', ... }
🆕 [users.new #2] Received: { id: 2, name: 'User 2', ... }
🔄 [users.update #1] Received: { id: 1, name: 'Updated User 1', ... }
📊 Stats: 5 new users, 2 user updates
```

### Test de l'interface NATS UI

1. Lancez le serveur de test
2. Connectez-vous à `nats://localhost:4222` dans l'interface
3. Allez dans "Topics" et vous devriez voir `users.new` et `users.update`
4. Souscrivez aux sujets pour voir les messages en temps réel
5. Dans "Monitoring", vérifiez les métriques en temps réel

## Arrêt des scripts

Utilisez `Ctrl+C` dans chaque terminal pour arrêter proprement les scripts.

## ⚠️ Important : NATS Core vs JetStream

**Pourquoi mes messages n'apparaissent pas dans les Streams ?**

Par défaut, les scripts `server.js` et `client.js` utilisent **NATS Core** (messages fire-and-forget). Les messages passent directement du publisher au subscriber sans être stockés.

La page **Streams** de l'interface montre uniquement les **JetStream streams** qui persistent et stockent les messages.

**Solution :**
1. Créez un stream JetStream avec `node create-stream.js`
2. Le stream capture automatiquement tous les messages `users.*`
3. Maintenant vous verrez le stream "USERS" dans l'interface !

**Différence :**
- **NATS Core** : Messages volatiles, pas de stockage
- **JetStream** : Messages persistés, rejouables, avec métadonnées