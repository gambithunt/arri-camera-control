# ARRI Camera Control App

A Progressive Web Application for remote control and monitoring of ARRI cameras via the Camera Access Protocol (CAP).

## Features

- **Camera Control**: Frame rate, white balance, ISO, ND filters, and more
- **Playback**: Browse and control recorded clips
- **Timecode Management**: Sync and manage timecode settings
- **Color Grading**: Real-time CDL adjustments with touch-friendly controls
- **Offline Support**: Works without internet connection on iPad
- **Mobile Optimized**: Touch-friendly interface for tablets and phones

## Development Setup

### Prerequisites
- Node.js 18+
- Docker (optional, for containerized development)

### Quick Start

1. **Frontend Development**:
   ```bash
   npm install
   npm run dev
   ```

2. **Backend Development**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Docker Development** (optional):
   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

### Testing

- **Frontend Tests**: `npm run test`
- **Backend Tests**: `cd backend && npm test`
- **E2E Tests**: `npm run test:e2e`

## Architecture

- **Frontend**: SvelteKit 5 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Protocol**: ARRI Camera Access Protocol (CAP) over TCP
- **Deployment**: Progressive Web App (PWA) for offline iPad usage

## CAP Protocol Support

Supports ARRI CAP protocol version 1.12 with:
- 86 camera commands
- 232 camera variables
- Real-time variable subscriptions
- Comprehensive error handling

## Production Deployment

The app is designed to run entirely offline on an iPad, connecting directly to ARRI cameras via local network without requiring internet connectivity.