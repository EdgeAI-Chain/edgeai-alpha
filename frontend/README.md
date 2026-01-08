# EdgeAI Explorer

EdgeAI Explorer is a high-performance, real-time blockchain surveillance system designed for the EdgeAI network. It provides comprehensive visualization of network activity, including block production, transaction flows, validator distribution, and IoT device data integration.

![EdgeAI Explorer Dashboard](https://github.com/user-attachments/assets/placeholder-image)

## Features

*   **Real-time Dashboard**: Live monitoring of block height, difficulty, hashrate, and TPS with dynamic updates.
*   **3D Network Visualization**: Interactive 3D globe showing the geographical distribution of validator nodes and real-time transaction propagation.
*   **IoT Integration**: Specialized support for visualizing IoT data transactions, including sector classification (Smart City, Agriculture, Industrial) and device metadata.
*   **Block & Transaction Inspection**: Detailed views for exploring blocks, transactions, and address histories.
*   **Responsive Design**: Fully optimized for desktop and mobile devices with a futuristic, dark-themed UI.

## Tech Stack

*   **Frontend**: React 19, TypeScript, Vite
*   **Styling**: Tailwind CSS 4, Shadcn/UI
*   **Visualization**: Cobe (3D Globe), Recharts, Lightweight Charts
*   **State Management**: React Hooks & Context
*   **Routing**: Wouter

## Getting Started

### Prerequisites

*   Node.js 18+
*   pnpm 9+

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Free0x/edgeai-explorer-alpha.git
    cd edgeai-explorer-alpha
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Start the development server:
    ```bash
    pnpm dev
    ```

4.  Open `http://localhost:3000` in your browser.

## Project Structure

```
client/
  src/
    components/   # Reusable UI components
    pages/        # Application routes/pages
    lib/          # Utilities and API clients
    hooks/        # Custom React hooks
    assets/       # Static assets
server/           # Backend API (In development)
shared/           # Shared types and constants
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
