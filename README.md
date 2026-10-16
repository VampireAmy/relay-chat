# Relay Chat — Setup Guide

A minimal real-time chat: a tiny server forwards encrypted messages between two participants. The server never sees plaintext — only ciphertext blobs, providing automated encryption over a live connection.

## Prerequisites
- Administrative access to run processes on the target VPS hosting environment.
- Node.js installed on the VPS (`node -v` to check; can be installed via `apt install nodejs npm` on Debian/Ubuntu systems).
- One open inbound port on the VPS firewall (default configuration: 8181).

## 1. Upload the Files
Copy the `relay-chat` directory containing `server.js`, `package.json`, and the `public/index.html` client folder to the VPS using `scp`, SFTP, or a hosting control panel file manager.

## 2. Install Dependencies and Start the Server
Navigate to the directory and start the process:
```bash
cd relay-chat
npm install
node server.js
```
The terminal should display `relay listening on port 8181`. To ensure the server continues running after closing the terminal session, utilize a process manager like PM2:
```bash
npm install -g pm2
pm2 start server.js --name relay
pm2 save
```

## 3. Configure the Firewall
Configure the system firewall (e.g., `ufw`, `iptables`, or provider-level network security groups) to allow inbound traffic on port 8181.

## 4. (Recommended) Configure HTTPS/WSS Reverse Proxy
Modern web browsers enforce strict security contexts for web socket connections. If the VPS already utilizes a domain and Nginx, add a reverse proxy block to serve the chat application securely over `wss://` instead of unencrypted `ws://`. Unencrypted connections over `ws://<VPS-IP>:8181` remain functional for initial testing phases.

## 5. Launch the Client Interface
Open the `public/index.html` file in a web browser. The file can be hosted on a static web server or opened locally on individual devices, as only the backend server component requires centralized hosting.

Both users must configure the following connection parameters:
- **Server address**: `wss://your-vps-address:8181` (or `ws://` if not utilizing a TLS-secured domain).
- **Room name**: A unique identifier string agreed upon by both participants to establish a private channel.
- **Passphrase**: A shared secret key used for end-to-end client-side encryption. This value is never transmitted to the server.

Once both clients connect to the same room using matching passphrases, messages transmit instantly and decrypt automatically.

## Local Area Network (LAN) Testing
To test functionalities locally before deploying to a production VPS, the application can run entirely on a local workstation and accept connections from other devices on the same local network.

1. **Verify Node.js Installation** on the local computer.
2. **Execute the Server**:
   ```bash
   cd relay-chat
   npm install
   node server.js
   ```
3. **Identify the Local IP Address**:
   - **Windows**: Open Command Prompt and execute `ipconfig` to locate the "IPv4 Address" (e.g., `192.168.1.23`).
   - **macOS/Linux**: Open a terminal window and execute `ifconfig` or `ip addr`.
4. **Configure Local Firewall**: Allow connections through the local OS firewall if prompted upon starting the node application.
5. **Local Access**: Open a browser on the host machine and navigate to `http://localhost:8181`. Click the **+** icon to add a room; the application will automatically populate the server address.
6. **Network Access**: Connect other devices (e.g., smartphones) to the same Wi-Fi network and navigate to `http://<host-pc-ip>:8181`.
7. Enter matching room names and passphrases across devices to initiate the encrypted chat session.

### Security Context and Encryption Restrictions
Web browsers restrict access to the Web Crypto API (required for application encryption) to secure origins: `https://` URLs or `http://localhost`. Standard LAN IP addresses (e.g., `http://192.168.x.x`) do not meet this criterion, causing browsers to block encryption capabilities and trigger an application error message.

For local testing scenarios utilizing Chromium-based browsers, this restriction can be bypassed:
1. Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`.
2. Input the local network address (e.g., `http://192.168.1.102:8181`).
3. Enable the flag and relaunch the browser application.
4. Repeat this configuration on any secondary testing devices running Chrome.

*Note: This adjustment is exclusively required for local network testing. Standard production deployments utilizing valid `wss://` connections satisfy secure context requirements natively.*

## Client Interface Features
The `public/index.html` interface includes a multi-room management panel to handle multiple distinct room profiles.

- **Responsive Design**: Displays a dual-column layout (room list on the left, active chat on the right) on wide screens, and toggles between views via a back navigation button on narrow mobile viewports.
- **Emoji Support**: Provides an integrated emoji picker on desktop systems. On mobile operating systems, it focuses the text field to utilize native system keyboard emoji inputs.
- **Chat Interactivity**: Includes standard text bubbles, delivery status indicators, active typing notifications, message replies, and message reactions.
- **Local Text Persistence**: Chat history persists directly within the local device browser storage. Data remains saved when switching rooms or closing tabs. 
  - The **Download** icon exports active text history to a plain-text file.
  - The **Clear** icon permanently removes message history from the current local device without altering the history stored on the peer device.
- **Media Management**: Supports inline photo transmission. Images undergo client-side compression (maximum 1280px width, JPEG format) before encryption. Photos populate dynamically within active sessions but do not save to local persistent history due to browser storage quota limits.
- **Simultaneous Multi-Device Sessions**: Multiple client instances can connect using identical identity parameters simultaneously. Actions such as messages, edits, reactions, and deletions synchronize across all active devices in real-time. This synchronization relies entirely on active connections; offline devices will not back-populate missed data due to the zero-storage architecture of the server.

## Advanced Features
- **Markdown Text Formatting**: Supports standard bold (`**text**`) and italic (`*text*` or `_text_`) notation. Inputs undergo escaping protocols prior to rendering to mitigate injection risks.
- **Message Modification**: Supports editing and deletion of sent messages. Edited items display an edited label, while deleted messages clear from local device storage and update to a placeholder message on both endpoints.
- **Granular Delivery Receipts**: Status checks track transmission: one check indicates successful relay delivery, two gray checks confirm peer device decryption, and two blue checks signal active window focus on the peer application.
- **Local History Search**: The index header contains a filtering tool to scan and jump between text matches within the currently loaded local room history.
- **Voice Messages**: An integrated microphone tool captures, encrypts, and transmits short audio files inline.
- **Connection Resilience**: Implements an exponential backoff auto-reconnect routine if network connectivity drops.
- **Offline Transmission Queue**: Messages sent during network dropouts queue locally with a pending status and transmit automatically upon reconnection.
- **Privacy-Focused Notifications**: Features optional system notifications that trigger generic text indicators ("New message") without exposing sender names or encrypted contents on lock screens.
- **Media Archiving**: Active image and voice messages include download utilities to save media files locally before ending a session. Unsaved media items display as generic placeholders upon initiating a new session.

## Architecture Limitations
- **Capacity Limits**: Rooms are strictly limited to a maximum of two simultaneous connections.
- **Stateless Server Design**: Backend server restarts wipe all current routing states. Because the server stores no data logs, users must simply refresh the client page to reconnect and resume communication.
- **Metadata Exposure**: While message contents remain entirely encrypted and unreadable to third parties, the hosting provider or server administrator can view active connection statuses, IP endpoints, and transmission timestamps.
