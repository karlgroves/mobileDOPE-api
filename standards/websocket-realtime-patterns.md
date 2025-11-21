# WebSocket and Real-time Communication Patterns

This document provides comprehensive patterns and standards for implementing real-time communication in REST-Base
applications using WebSockets, Server-Sent Events, and other real-time technologies.

## Table of Contents

* [Overview](#overview)
* [Communication Protocols](#communication-protocols)
* [WebSocket Implementation](#websocket-implementation)
* [Server-Sent Events (SSE)](#server-sent-events-sse)
* [Real-time Architecture Patterns](#real-time-architecture-patterns)
* [Authentication and Authorization](#authentication-and-authorization)
* [Message Patterns](#message-patterns)
* [Scaling and Performance](#scaling-and-performance)
* [Security Considerations](#security-considerations)
* [Testing Strategies](#testing-strategies)

## Overview

### Real-time Communication Use Cases

1. **Live Chat Systems** - Instant messaging and group conversations
2. **Collaborative Editing** - Real-time document editing and synchronization
3. **Live Updates** - Dashboard updates, notifications, and status changes
4. **Gaming** - Multiplayer games and real-time interactions
5. **Trading Systems** - Real-time price updates and order execution
6. **IoT Applications** - Sensor data streaming and device control
7. **Live Streaming** - Video/audio streaming and chat integration

### Technology Comparison

| Technology | Use Case | Pros | Cons |
|------------|----------|------|------|
| WebSockets | Bi-directional, high-frequency | Low latency, full duplex | Complex scaling, connection management |
| Server-Sent Events | Server-to-client updates | Simple, HTTP-compatible | Uni-directional, browser limitations |
| Long Polling | Simple real-time updates | HTTP-compatible, simple | Higher latency, resource intensive |
| WebRTC | P2P communication | Direct connection, low latency | Complex setup, NAT traversal |

## Communication Protocols

### 1. WebSocket Protocol Standards

```javascript
// WebSocket message format standards
const MessageTypes = {
  // System messages
  SYSTEM: {
    PING: 'ping',
    PONG: 'pong',
    HEARTBEAT: 'heartbeat',
    ERROR: 'error',
    AUTH: 'auth',
    DISCONNECT: 'disconnect'
  },
  
  // Application messages
  APPLICATION: {
    CHAT_MESSAGE: 'chat_message',
    USER_JOIN: 'user_join',
    USER_LEAVE: 'user_leave',
    STATUS_UPDATE: 'status_update',
    NOTIFICATION: 'notification'
  },
  
  // Data operations
  DATA: {
    CREATE: 'data_create',
    UPDATE: 'data_update',
    DELETE: 'data_delete',
    SYNC: 'data_sync'
  }
};

// Standard message envelope
const MessageEnvelope = {
  id: 'unique_message_id',
  type: 'message_type',
  timestamp: 'iso_timestamp',
  payload: {}, // Message-specific data
  metadata: {
    version: '1.0',
    source: 'client_or_server',
    correlation_id: 'optional_correlation_id'
  }
};
```

### 2. Message Protocol Definition

```javascript
// protocols/websocket.js
class WebSocketProtocol {
  static createMessage(type, payload, options = {}) {
    return {
      id: options.id || this.generateId(),
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata: {
        version: '1.0',
        source: options.source || 'server',
        correlation_id: options.correlationId,
        ...options.metadata
      }
    };
  }
  
  static validateMessage(message) {
    const required = ['id', 'type', 'timestamp', 'payload'];
    
    for (const field of required) {
      if (!(field in message)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    if (!this.isValidType(message.type)) {
      throw new Error(`Invalid message type: ${message.type}`);
    }
    
    return true;
  }
  
  static isValidType(type) {
    const allTypes = [
      ...Object.values(MessageTypes.SYSTEM),
      ...Object.values(MessageTypes.APPLICATION),
      ...Object.values(MessageTypes.DATA)
    ];
    
    return allTypes.includes(type);
  }
  
  static generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = WebSocketProtocol;
```

## WebSocket Implementation

### 1. Server-Side WebSocket Handler

```javascript
// websocket/server.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const WebSocketProtocol = require('../protocols/websocket');

class WebSocketServer {
  constructor(server, options = {}) {
    this.wss = new WebSocket.Server({
      server,
      port: options.port,
      path: options.path || '/ws',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.clients = new Map(); // clientId -> WebSocket
    this.rooms = new Map();   // roomId -> Set<clientId>
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    
    this.setupEventHandlers();
    this.startHeartbeat();
  }
  
  setupEventHandlers() {
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleError.bind(this));
  }
  
  async verifyClient(info) {
    try {
      const token = this.extractToken(info.req);
      if (!token) return false;
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      info.req.user = decoded;
      return true;
    } catch (error) {
      logger.warn('WebSocket authentication failed', { 
        error: error.message,
        ip: info.req.socket.remoteAddress 
      });
      return false;
    }
  }
  
  extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter as fallback
    const url = new URL(req.url, `http://${req.headers.host}`);
    return url.searchParams.get('token');
  }
  
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const user = req.user;
    
    // Store client information
    this.clients.set(clientId, {
      ws,
      user,
      clientId,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    });
    
    // Setup client event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleClientError(clientId, error));
    
    // Send welcome message
    this.sendToClient(clientId, WebSocketProtocol.createMessage(
      MessageTypes.SYSTEM.AUTH,
      { status: 'connected', clientId }
    ));
    
    logger.info('WebSocket client connected', { 
      clientId, 
      userId: user.id,
      ip: req.socket.remoteAddress 
    });
  }
  
  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      WebSocketProtocol.validateMessage(message);
      
      // Update last seen
      const client = this.clients.get(clientId);
      if (client) {
        client.lastSeen = Date.now();
      }
      
      // Route message based on type
      await this.routeMessage(clientId, message);
      
    } catch (error) {
      logger.error('Invalid WebSocket message', { 
        clientId, 
        error: error.message,
        data: data.toString()
      });
      
      this.sendToClient(clientId, WebSocketProtocol.createMessage(
        MessageTypes.SYSTEM.ERROR,
        { error: 'Invalid message format' }
      ));
    }
  }
  
  async routeMessage(clientId, message) {
    const { type, payload } = message;
    
    switch (type) {
      case MessageTypes.SYSTEM.PING:
        await this.handlePing(clientId, message);
        break;
        
      case MessageTypes.APPLICATION.CHAT_MESSAGE:
        await this.handleChatMessage(clientId, message);
        break;
        
      case MessageTypes.DATA.UPDATE:
        await this.handleDataUpdate(clientId, message);
        break;
        
      default:
        logger.warn('Unknown message type', { clientId, type });
    }
  }
  
  handlePing(clientId, message) {
    this.sendToClient(clientId, WebSocketProtocol.createMessage(
      MessageTypes.SYSTEM.PONG,
      { timestamp: Date.now() },
      { correlationId: message.id }
    ));
  }
  
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  broadcast(message, filter = null) {
    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      if (filter && !filter(client)) continue;
      
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = WebSocketServer;
```

### 2. Client-Side WebSocket Manager

```javascript
// client/websocket-manager.js
class WebSocketManager {
  constructor(options = {}) {
    this.url = options.url || this.getWebSocketUrl();
    this.token = options.token;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    
    this.ws = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.eventHandlers = new Map();
    
    this.setupEventHandlers();
  }
  
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      const wsUrl = this.token ? 
        `${this.url}?token=${this.token}` : 
        this.url;
        
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      };
      
      this.ws.onclose = (event) => {
        this.connected = false;
        this.stopHeartbeat();
        this.emit('disconnected', event);
        this.handleReconnection();
      };
      
      this.ws.onerror = (error) => {
        this.emit('error', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.stopHeartbeat();
  }
  
  send(type, payload, options = {}) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }
    
    const message = {
      id: this.generateId(),
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata: {
        version: '1.0',
        source: 'client',
        ...options.metadata
      }
    };
    
    this.ws.send(JSON.stringify(message));
    return message.id;
  }
  
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Check for specific message handlers
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      }
      
      // Emit general message event
      this.emit('message', message);
      
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }
  
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }
  
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }
  
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
  
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.send('ping', { timestamp: Date.now() });
      }
    }, this.heartbeatInterval);
  }
  
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.emit('reconnecting', this.reconnectAttempts);
        this.connect().catch(() => {
          // Reconnection will be handled by onclose event
        });
      }, delay);
    } else {
      this.emit('reconnection_failed');
    }
  }
  
  getWebSocketUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Server-Sent Events (SSE)

### 1. SSE Server Implementation

```javascript
// sse/server.js
const logger = require('../utils/logger');

class SSEServer {
  constructor() {
    this.clients = new Map(); // clientId -> response object
    this.channels = new Map(); // channelId -> Set<clientId>
  }
  
  handleConnection(req, res) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    const clientId = this.generateClientId();
    
    // Store client
    this.clients.set(clientId, {
      response: res,
      clientId,
      connectedAt: Date.now(),
      channels: new Set()
    });
    
    // Handle client disconnect
    req.on('close', () => {
      this.handleDisconnection(clientId);
    });
    
    req.on('error', (error) => {
      logger.error('SSE client error', { clientId, error: error.message });
      this.handleDisconnection(clientId);
    });
    
    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connection',
      data: { clientId, timestamp: Date.now() }
    });
    
    logger.info('SSE client connected', { clientId });
    
    return clientId;
  }
  
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    try {
      const formattedMessage = this.formatSSEMessage(message);
      client.response.write(formattedMessage);
      return true;
    } catch (error) {
      logger.error('Failed to send SSE message', { 
        clientId, 
        error: error.message 
      });
      this.handleDisconnection(clientId);
      return false;
    }
  }
  
  broadcast(message, channelId = null) {
    let targetClients;
    
    if (channelId) {
      const channelClients = this.channels.get(channelId) || new Set();
      targetClients = Array.from(channelClients);
    } else {
      targetClients = Array.from(this.clients.keys());
    }
    
    let sentCount = 0;
    
    for (const clientId of targetClients) {
      if (this.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  subscribeToChannel(clientId, channelId) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    // Add client to channel
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId).add(clientId);
    
    // Track channel in client
    client.channels.add(channelId);
    
    logger.info('Client subscribed to channel', { clientId, channelId });
    return true;
  }
  
  unsubscribeFromChannel(clientId, channelId) {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    // Remove client from channel
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.delete(clientId);
      if (channel.size === 0) {
        this.channels.delete(channelId);
      }
    }
    
    // Remove channel from client
    client.channels.delete(channelId);
    
    logger.info('Client unsubscribed from channel', { clientId, channelId });
    return true;
  }
  
  formatSSEMessage(message) {
    let formatted = '';
    
    if (message.id) {
      formatted += `id: ${message.id}\n`;
    }
    
    if (message.event) {
      formatted += `event: ${message.event}\n`;
    }
    
    const data = typeof message.data === 'string' ? 
      message.data : 
      JSON.stringify(message.data);
      
    formatted += `data: ${data}\n\n`;
    
    return formatted;
  }
  
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Remove from all channels
    for (const channelId of client.channels) {
      this.unsubscribeFromChannel(clientId, channelId);
    }
    
    // Remove client
    this.clients.delete(clientId);
    
    logger.info('SSE client disconnected', { clientId });
  }
  
  generateClientId() {
    return `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeChannels: this.channels.size,
      totalSubscriptions: Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.channels.size, 0)
    };
  }
}

module.exports = SSEServer;
```

### 2. SSE Client Implementation

```javascript
// client/sse-client.js
class SSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.eventSource = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 1000;
    
    this.eventHandlers = new Map();
  }
  
  connect() {
    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      };
      
      this.eventSource.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.eventSource.onerror = (error) => {
        this.connected = false;
        this.emit('error', error);
        
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.handleReconnection();
        }
      };
      
      // Handle custom events
      this.setupCustomEventHandlers();
    });
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
    this.emit('disconnected');
  }
  
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    
    // Add SSE event listener for custom events
    if (this.eventSource && event !== 'connected' && event !== 'disconnected' && event !== 'error') {
      this.eventSource.addEventListener(event, (sseEvent) => {
        this.handleCustomEvent(event, sseEvent);
      });
    }
  }
  
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }
  
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      this.emit('message', { 
        id: event.lastEventId, 
        data, 
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  }
  
  handleCustomEvent(eventType, sseEvent) {
    try {
      const data = JSON.parse(sseEvent.data);
      this.emit(eventType, { 
        id: sseEvent.lastEventId, 
        data, 
        timestamp: Date.now() 
      });
    } catch (error) {
      console.error(`Failed to parse SSE ${eventType} event:`, error);
    }
  }
  
  setupCustomEventHandlers() {
    // This will be called when custom event handlers are added
    for (const [event] of this.eventHandlers) {
      if (event !== 'connected' && event !== 'disconnected' && event !== 'error' && event !== 'message') {
        this.eventSource.addEventListener(event, (sseEvent) => {
          this.handleCustomEvent(event, sseEvent);
        });
      }
    }
  }
  
  handleReconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.emit('reconnecting', this.reconnectAttempts);
        this.connect().catch(() => {
          // Will retry through error handler
        });
      }, delay);
    } else {
      this.emit('reconnection_failed');
    }
  }
}
```

## Real-time Architecture Patterns

### 1. Pub/Sub Pattern

```javascript
// patterns/pubsub.js
const Redis = require('redis');
const logger = require('../utils/logger');

class PubSubManager {
  constructor(options = {}) {
    this.publisher = Redis.createClient(options.redis);
    this.subscriber = Redis.createClient(options.redis);
    this.localSubscribers = new Map(); // channel -> Set<callback>
    
    this.setupSubscriber();
  }
  
  async setupSubscriber() {
    await this.subscriber.connect();
    
    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }
  
  async publish(channel, data) {
    const message = JSON.stringify({
      timestamp: Date.now(),
      data
    });
    
    await this.publisher.publish(channel, message);
    
    logger.debug('Published message', { channel, data });
  }
  
  async subscribe(channel, callback) {
    // Add local subscriber
    if (!this.localSubscribers.has(channel)) {
      this.localSubscribers.set(channel, new Set());
      // Subscribe to Redis channel if first subscriber
      await this.subscriber.subscribe(channel);
    }
    
    this.localSubscribers.get(channel).add(callback);
    
    logger.debug('Added subscriber', { channel });
  }
  
  async unsubscribe(channel, callback) {
    const subscribers = this.localSubscribers.get(channel);
    if (!subscribers) return;
    
    subscribers.delete(callback);
    
    // Unsubscribe from Redis if no more local subscribers
    if (subscribers.size === 0) {
      this.localSubscribers.delete(channel);
      await this.subscriber.unsubscribe(channel);
    }
    
    logger.debug('Removed subscriber', { channel });
  }
  
  handleMessage(channel, message) {
    try {
      const parsed = JSON.parse(message);
      const subscribers = this.localSubscribers.get(channel) || new Set();
      
      for (const callback of subscribers) {
        try {
          callback(parsed.data, channel);
        } catch (error) {
          logger.error('Subscriber callback error', { 
            channel, 
            error: error.message 
          });
        }
      }
    } catch (error) {
      logger.error('Failed to parse pub/sub message', { 
        channel, 
        message, 
        error: error.message 
      });
    }
  }
}

module.exports = PubSubManager;
```

### 2. Room-Based Architecture

```javascript
// patterns/rooms.js
class RoomManager {
  constructor(webSocketServer, pubSubManager) {
    this.wss = webSocketServer;
    this.pubsub = pubSubManager;
    this.rooms = new Map(); // roomId -> Room
    this.clientRooms = new Map(); // clientId -> Set<roomId>
  }
  
  async joinRoom(clientId, roomId, metadata = {}) {
    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId, this.pubsub));
    }
    
    const room = this.rooms.get(roomId);
    await room.addClient(clientId, metadata);
    
    // Track client rooms
    if (!this.clientRooms.has(clientId)) {
      this.clientRooms.set(clientId, new Set());
    }
    this.clientRooms.get(clientId).add(roomId);
    
    // Notify room members
    await this.broadcastToRoom(roomId, {
      type: 'user_joined',
      data: { clientId, metadata, timestamp: Date.now() }
    }, [clientId]); // Exclude the joining client
    
    logger.info('Client joined room', { clientId, roomId });
  }
  
  async leaveRoom(clientId, roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    await room.removeClient(clientId);
    
    // Update client rooms tracking
    const clientRooms = this.clientRooms.get(clientId);
    if (clientRooms) {
      clientRooms.delete(roomId);
      if (clientRooms.size === 0) {
        this.clientRooms.delete(clientId);
      }
    }
    
    // Remove room if empty
    if (room.isEmpty()) {
      await room.destroy();
      this.rooms.delete(roomId);
    } else {
      // Notify remaining room members
      await this.broadcastToRoom(roomId, {
        type: 'user_left',
        data: { clientId, timestamp: Date.now() }
      });
    }
    
    logger.info('Client left room', { clientId, roomId });
  }
  
  async broadcastToRoom(roomId, message, excludeClients = []) {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    
    const clients = room.getClients();
    const excludeSet = new Set(excludeClients);
    let sentCount = 0;
    
    for (const clientId of clients) {
      if (excludeSet.has(clientId)) continue;
      
      if (this.wss.sendToClient(clientId, message)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  async handleClientDisconnection(clientId) {
    const clientRooms = this.clientRooms.get(clientId);
    if (!clientRooms) return;
    
    // Leave all rooms
    for (const roomId of clientRooms) {
      await this.leaveRoom(clientId, roomId);
    }
  }
  
  getRoomStats(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.getStats() : null;
  }
}

class Room {
  constructor(id, pubSubManager) {
    this.id = id;
    this.pubsub = pubSubManager;
    this.clients = new Map(); // clientId -> metadata
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
  }
  
  async addClient(clientId, metadata) {
    this.clients.set(clientId, {
      ...metadata,
      joinedAt: Date.now()
    });
    this.lastActivity = Date.now();
    
    // Subscribe to room-specific events if first client
    if (this.clients.size === 1) {
      await this.pubsub.subscribe(`room:${this.id}`, this.handleRoomMessage.bind(this));
    }
  }
  
  async removeClient(clientId) {
    this.clients.delete(clientId);
    this.lastActivity = Date.now();
  }
  
  getClients() {
    return Array.from(this.clients.keys());
  }
  
  isEmpty() {
    return this.clients.size === 0;
  }
  
  async destroy() {
    await this.pubsub.unsubscribe(`room:${this.id}`, this.handleRoomMessage.bind(this));
  }
  
  handleRoomMessage(data, channel) {
    // Handle cross-server room messages
    logger.debug('Room message received', { roomId: this.id, data });
  }
  
  getStats() {
    return {
      id: this.id,
      clientCount: this.clients.size,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      clients: Array.from(this.clients.entries()).map(([clientId, metadata]) => ({
        clientId,
        ...metadata
      }))
    };
  }
}

module.exports = RoomManager;
```

## Authentication and Authorization

### 1. WebSocket Authentication

```javascript
// auth/websocket-auth.js
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class WebSocketAuth {
  constructor(options = {}) {
    this.secretKey = options.secretKey || process.env.JWT_SECRET;
    this.algorithms = options.algorithms || ['HS256'];
    this.tokenExpiry = options.tokenExpiry || '1h';
  }
  
  async authenticateConnection(request) {
    try {
      const token = this.extractToken(request);
      if (!token) {
        throw new Error('No authentication token provided');
      }
      
      const decoded = jwt.verify(token, this.secretKey, {
        algorithms: this.algorithms
      });
      
      // Additional validation
      await this.validateUser(decoded);
      
      return decoded;
    } catch (error) {
      logger.warn('WebSocket authentication failed', { 
        error: error.message,
        ip: request.socket.remoteAddress 
      });
      throw error;
    }
  }
  
  extractToken(request) {
    // Check Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check query parameter
    const url = new URL(request.url, `http://${request.headers.host}`);
    const tokenParam = url.searchParams.get('token');
    if (tokenParam) {
      return tokenParam;
    }
    
    // Check cookies
    const cookies = this.parseCookies(request.headers.cookie);
    if (cookies.token) {
      return cookies.token;
    }
    
    return null;
  }
  
  async validateUser(decoded) {
    // Check if user exists and is active
    const user = await this.getUserById(decoded.sub || decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.active) {
      throw new Error('User account is disabled');
    }
    
    // Check permissions
    if (decoded.permissions) {
      const hasWebSocketPermission = decoded.permissions.includes('websocket:connect');
      if (!hasWebSocketPermission) {
        throw new Error('Insufficient permissions for WebSocket connection');
      }
    }
    
    return user;
  }
  
  generateToken(user, permissions = []) {
    const payload = {
      sub: user.id,
      username: user.username,
      permissions: [...permissions, 'websocket:connect'],
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, this.secretKey, {
      expiresIn: this.tokenExpiry,
      algorithm: 'HS256'
    });
  }
  
  parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
      cookieHeader.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        cookies[name] = value;
      });
    }
    return cookies;
  }
  
  async getUserById(userId) {
    // Implementation depends on your user storage
    // This is a placeholder
    return {
      id: userId,
      username: 'user',
      active: true
    };
  }
}

module.exports = WebSocketAuth;
```

### 2. Real-time Authorization

```javascript
// auth/realtime-authz.js
class RealtimeAuthorization {
  constructor(options = {}) {
    this.permissions = new Map(); // clientId -> Set<permission>
    this.rolePermissions = new Map(); // role -> Set<permission>
    
    this.initializeRolePermissions();
  }
  
  initializeRolePermissions() {
    // Define role-based permissions
    this.rolePermissions.set('admin', new Set([
      'room:create',
      'room:delete',
      'room:moderate',
      'message:broadcast',
      'user:kick',
      'user:ban'
    ]));
    
    this.rolePermissions.set('moderator', new Set([
      'room:moderate',
      'message:delete',
      'user:warn'
    ]));
    
    this.rolePermissions.set('user', new Set([
      'room:join',
      'room:leave',
      'message:send',
      'message:receive'
    ]));
  }
  
  setClientPermissions(clientId, user) {
    const userPermissions = new Set();
    
    // Add role-based permissions
    if (user.roles) {
      for (const role of user.roles) {
        const rolePerms = this.rolePermissions.get(role) || new Set();
        for (const perm of rolePerms) {
          userPermissions.add(perm);
        }
      }
    }
    
    // Add specific user permissions
    if (user.permissions) {
      for (const perm of user.permissions) {
        userPermissions.add(perm);
      }
    }
    
    this.permissions.set(clientId, userPermissions);
  }
  
  hasPermission(clientId, permission) {
    const clientPermissions = this.permissions.get(clientId);
    return clientPermissions ? clientPermissions.has(permission) : false;
  }
  
  canJoinRoom(clientId, roomId, roomMetadata = {}) {
    // Check basic join permission
    if (!this.hasPermission(clientId, 'room:join')) {
      return false;
    }
    
    // Check room-specific restrictions
    if (roomMetadata.private && !this.hasPermission(clientId, 'room:join_private')) {
      return false;
    }
    
    if (roomMetadata.requiresInvite && !this.hasPermission(clientId, 'room:join_invited')) {
      return false;
    }
    
    return true;
  }
  
  canSendMessage(clientId, messageType, targetRoom = null) {
    // Check basic send permission
    if (!this.hasPermission(clientId, 'message:send')) {
      return false;
    }
    
    // Check message type permissions
    if (messageType === 'broadcast' && !this.hasPermission(clientId, 'message:broadcast')) {
      return false;
    }
    
    if (messageType === 'announcement' && !this.hasPermission(clientId, 'message:announce')) {
      return false;
    }
    
    // Check room-specific permissions
    if (targetRoom && targetRoom.moderated && !this.hasPermission(clientId, 'room:moderate')) {
      return false;
    }
    
    return true;
  }
  
  canModerateRoom(clientId, roomId) {
    return this.hasPermission(clientId, 'room:moderate');
  }
  
  removeClientPermissions(clientId) {
    this.permissions.delete(clientId);
  }
  
  updateClientPermissions(clientId, newPermissions) {
    this.permissions.set(clientId, new Set(newPermissions));
  }
  
  getClientPermissions(clientId) {
    return Array.from(this.permissions.get(clientId) || []);
  }
}

module.exports = RealtimeAuthorization;
```

## Message Patterns

### 1. Request-Response Pattern

```javascript
// patterns/request-response.js
class RequestResponseManager {
  constructor(webSocketServer) {
    this.wss = webSocketServer;
    this.pendingRequests = new Map(); // messageId -> { resolve, reject, timeout }
    this.defaultTimeout = 30000; // 30 seconds
  }
  
  async sendRequest(clientId, type, payload, timeout = this.defaultTimeout) {
    const messageId = this.generateMessageId();
    
    const message = {
      id: messageId,
      type,
      timestamp: new Date().toISOString(),
      payload,
      metadata: {
        requestResponse: true,
        source: 'server'
      }
    };
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      // Store pending request
      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        timestamp: Date.now()
      });
      
      // Send message
      const sent = this.wss.sendToClient(clientId, message);
      if (!sent) {
        this.pendingRequests.delete(messageId);
        clearTimeout(timeoutHandle);
        reject(new Error('Failed to send message to client'));
      }
    });
  }
  
  handleResponse(message) {
    const correlationId = message.metadata?.correlationId;
    if (!correlationId) return false;
    
    const pendingRequest = this.pendingRequests.get(correlationId);
    if (!pendingRequest) return false;
    
    // Clean up
    this.pendingRequests.delete(correlationId);
    clearTimeout(pendingRequest.timeout);
    
    // Resolve with response
    if (message.payload.error) {
      pendingRequest.reject(new Error(message.payload.error));
    } else {
      pendingRequest.resolve(message.payload);
    }
    
    return true;
  }
  
  sendResponse(clientId, originalMessage, responsePayload, error = null) {
    const responseMessage = {
      id: this.generateMessageId(),
      type: `${originalMessage.type}_response`,
      timestamp: new Date().toISOString(),
      payload: error ? { error } : responsePayload,
      metadata: {
        correlationId: originalMessage.id,
        source: 'server'
      }
    };
    
    return this.wss.sendToClient(clientId, responseMessage);
  }
  
  generateMessageId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  cleanup() {
    // Clean up expired requests
    const now = Date.now();
    const expiredRequests = [];
    
    for (const [messageId, request] of this.pendingRequests) {
      if (now - request.timestamp > this.defaultTimeout) {
        expiredRequests.push(messageId);
      }
    }
    
    for (const messageId of expiredRequests) {
      const request = this.pendingRequests.get(messageId);
      if (request) {
        clearTimeout(request.timeout);
        request.reject(new Error('Request expired'));
        this.pendingRequests.delete(messageId);
      }
    }
    
    return expiredRequests.length;
  }
}
```

### 2. Event Streaming Pattern

```javascript
// patterns/event-streaming.js
class EventStreamManager {
  constructor(webSocketServer, pubSubManager) {
    this.wss = webSocketServer;
    this.pubsub = pubSubManager;
    this.streams = new Map(); // streamId -> Stream
    this.clientStreams = new Map(); // clientId -> Set<streamId>
  }
  
  async createStream(streamId, options = {}) {
    if (this.streams.has(streamId)) {
      throw new Error(`Stream ${streamId} already exists`);
    }
    
    const stream = new EventStream(streamId, this.pubsub, options);
    await stream.initialize();
    
    this.streams.set(streamId, stream);
    
    logger.info('Event stream created', { streamId, options });
    return stream;
  }
  
  async subscribeToStream(clientId, streamId, filter = null) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    await stream.addSubscriber(clientId, filter);
    
    // Track client subscriptions
    if (!this.clientStreams.has(clientId)) {
      this.clientStreams.set(clientId, new Set());
    }
    this.clientStreams.get(clientId).add(streamId);
    
    logger.info('Client subscribed to stream', { clientId, streamId });
  }
  
  async unsubscribeFromStream(clientId, streamId) {
    const stream = this.streams.get(streamId);
    if (stream) {
      await stream.removeSubscriber(clientId);
    }
    
    const clientStreams = this.clientStreams.get(clientId);
    if (clientStreams) {
      clientStreams.delete(streamId);
      if (clientStreams.size === 0) {
        this.clientStreams.delete(clientId);
      }
    }
    
    logger.info('Client unsubscribed from stream', { clientId, streamId });
  }
  
  async publishToStream(streamId, event) {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    await stream.publish(event);
  }
  
  async handleClientDisconnection(clientId) {
    const clientStreams = this.clientStreams.get(clientId);
    if (!clientStreams) return;
    
    for (const streamId of clientStreams) {
      await this.unsubscribeFromStream(clientId, streamId);
    }
  }
}

class EventStream {
  constructor(id, pubSubManager, options = {}) {
    this.id = id;
    this.pubsub = pubSubManager;
    this.subscribers = new Map(); // clientId -> filter
    this.buffer = [];
    this.bufferSize = options.bufferSize || 100;
    this.retentionTime = options.retentionTime || 3600000; // 1 hour
    this.persistent = options.persistent || false;
  }
  
  async initialize() {
    await this.pubsub.subscribe(`stream:${this.id}`, this.handleStreamEvent.bind(this));
    
    if (this.persistent) {
      await this.loadPersistedEvents();
    }
  }
  
  async addSubscriber(clientId, filter = null) {
    this.subscribers.set(clientId, filter);
    
    // Send buffered events to new subscriber
    for (const event of this.buffer) {
      if (this.passesFilter(event, filter)) {
        await this.sendEventToClient(clientId, event);
      }
    }
  }
  
  async removeSubscriber(clientId) {
    this.subscribers.delete(clientId);
  }
  
  async publish(event) {
    const streamEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      data: event
    };
    
    // Add to buffer
    this.addToBuffer(streamEvent);
    
    // Persist if configured
    if (this.persistent) {
      await this.persistEvent(streamEvent);
    }
    
    // Publish to subscribers
    await this.pubsub.publish(`stream:${this.id}`, streamEvent);
  }
  
  async handleStreamEvent(event) {
    // Send to all subscribers
    for (const [clientId, filter] of this.subscribers) {
      if (this.passesFilter(event, filter)) {
        await this.sendEventToClient(clientId, event);
      }
    }
  }
  
  async sendEventToClient(clientId, event) {
    const message = {
      type: 'stream_event',
      payload: {
        streamId: this.id,
        event
      }
    };
    
    // This would be implemented by the WebSocket server
    // this.wss.sendToClient(clientId, message);
  }
  
  passesFilter(event, filter) {
    if (!filter) return true;
    
    // Implement filtering logic based on event data
    if (filter.eventTypes && !filter.eventTypes.includes(event.data.type)) {
      return false;
    }
    
    if (filter.tags) {
      const eventTags = event.data.tags || [];
      const hasRequiredTag = filter.tags.some(tag => eventTags.includes(tag));
      if (!hasRequiredTag) return false;
    }
    
    return true;
  }
  
  addToBuffer(event) {
    this.buffer.push(event);
    
    // Remove old events
    while (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Remove expired events
    const cutoffTime = Date.now() - this.retentionTime;
    this.buffer = this.buffer.filter(e => e.timestamp > cutoffTime);
  }
  
  generateEventId() {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

## Scaling and Performance

### 1. Horizontal Scaling with Redis

```javascript
// scaling/redis-adapter.js
const Redis = require('redis');
const logger = require('../utils/logger');

class RedisAdapter {
  constructor(options = {}) {
    this.publisher = Redis.createClient(options.redis);
    this.subscriber = Redis.createClient(options.redis);
    this.serverId = options.serverId || `server_${Date.now()}`;
    this.messageHandlers = new Map();
    
    this.setupSubscriber();
  }
  
  async setupSubscriber() {
    await this.subscriber.connect();
    
    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
    
    // Subscribe to broadcast channels
    await this.subscriber.subscribe('ws:broadcast');
    await this.subscriber.subscribe(`ws:server:${this.serverId}`);
  }
  
  async broadcastToAll(message) {
    const payload = {
      type: 'broadcast',
      serverId: this.serverId,
      timestamp: Date.now(),
      message
    };
    
    await this.publisher.publish('ws:broadcast', JSON.stringify(payload));
  }
  
  async sendToServer(targetServerId, message) {
    const payload = {
      type: 'direct',
      serverId: this.serverId,
      timestamp: Date.now(),
      message
    };
    
    await this.publisher.publish(`ws:server:${targetServerId}`, JSON.stringify(payload));
  }
  
  async broadcastToRoom(roomId, message, excludeClients = []) {
    const payload = {
      type: 'room_broadcast',
      serverId: this.serverId,
      roomId,
      message,
      excludeClients,
      timestamp: Date.now()
    };
    
    await this.publisher.publish('ws:broadcast', JSON.stringify(payload));
  }
  
  handleMessage(channel, message) {
    try {
      const payload = JSON.parse(message);
      
      // Skip messages from this server
      if (payload.serverId === this.serverId) {
        return;
      }
      
      const handler = this.messageHandlers.get(payload.type);
      if (handler) {
        handler(payload);
      }
      
    } catch (error) {
      logger.error('Failed to handle Redis message', { 
        channel, 
        message, 
        error: error.message 
      });
    }
  }
  
  onMessage(type, handler) {
    this.messageHandlers.set(type, handler);
  }
  
  async trackClientConnection(clientId, serverId = this.serverId) {
    await this.publisher.hSet('ws:clients', clientId, serverId);
    await this.publisher.expire('ws:clients', 3600); // 1 hour TTL
  }
  
  async removeClientConnection(clientId) {
    await this.publisher.hDel('ws:clients', clientId);
  }
  
  async getClientServer(clientId) {
    return await this.publisher.hGet('ws:clients', clientId);
  }
  
  async getAllConnectedClients() {
    return await this.publisher.hGetAll('ws:clients');
  }
  
  async getServerStats() {
    const clients = await this.getAllConnectedClients();
    const serverCounts = {};
    
    for (const [clientId, serverId] of Object.entries(clients)) {
      serverCounts[serverId] = (serverCounts[serverId] || 0) + 1;
    }
    
    return {
      totalClients: Object.keys(clients).length,
      serverCounts
    };
  }
}

module.exports = RedisAdapter;
```

### 2. Load Balancing Configuration

```javascript
// scaling/load-balancer.js
class WebSocketLoadBalancer {
  constructor(options = {}) {
    this.servers = new Map(); // serverId -> ServerInfo
    this.strategy = options.strategy || 'round_robin';
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.maxConnections = options.maxConnections || 10000;
    
    this.startHealthChecks();
  }
  
  addServer(serverId, config) {
    this.servers.set(serverId, {
      id: serverId,
      host: config.host,
      port: config.port,
      connections: 0,
      healthy: true,
      lastHealthCheck: Date.now(),
      maxConnections: config.maxConnections || this.maxConnections
    });
    
    logger.info('Added WebSocket server', { serverId, config });
  }
  
  removeServer(serverId) {
    this.servers.delete(serverId);
    logger.info('Removed WebSocket server', { serverId });
  }
  
  selectServer() {
    const healthyServers = Array.from(this.servers.values())
      .filter(server => server.healthy && server.connections < server.maxConnections);
      
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }
    
    switch (this.strategy) {
      case 'round_robin':
        return this.selectRoundRobin(healthyServers);
      case 'least_connections':
        return this.selectLeastConnections(healthyServers);
      case 'random':
        return this.selectRandom(healthyServers);
      default:
        return this.selectRoundRobin(healthyServers);
    }
  }
  
  selectRoundRobin(servers) {
    // Simple round-robin implementation
    const now = Date.now();
    const index = Math.floor(now / 1000) % servers.length;
    return servers[index];
  }
  
  selectLeastConnections(servers) {
    return servers.reduce((min, server) => 
      server.connections < min.connections ? server : min
    );
  }
  
  selectRandom(servers) {
    return servers[Math.floor(Math.random() * servers.length)];
  }
  
  recordConnection(serverId) {
    const server = this.servers.get(serverId);
    if (server) {
      server.connections++;
    }
  }
  
  recordDisconnection(serverId) {
    const server = this.servers.get(serverId);
    if (server) {
      server.connections = Math.max(0, server.connections - 1);
    }
  }
  
  startHealthChecks() {
    setInterval(async () => {
      await this.performHealthChecks();
    }, this.healthCheckInterval);
  }
  
  async performHealthChecks() {
    const promises = Array.from(this.servers.values()).map(server => 
      this.checkServerHealth(server)
    );
    
    await Promise.allSettled(promises);
  }
  
  async checkServerHealth(server) {
    try {
      // Implement health check (HTTP endpoint, ping, etc.)
      const response = await fetch(`http://${server.host}:${server.port}/health`);
      
      if (response.ok) {
        server.healthy = true;
        server.lastHealthCheck = Date.now();
      } else {
        throw new Error(`Health check failed: ${response.status}`);
      }
    } catch (error) {
      server.healthy = false;
      logger.warn('Server health check failed', { 
        serverId: server.id, 
        error: error.message 
      });
    }
  }
  
  getStats() {
    const servers = Array.from(this.servers.values());
    
    return {
      totalServers: servers.length,
      healthyServers: servers.filter(s => s.healthy).length,
      totalConnections: servers.reduce((sum, s) => sum + s.connections, 0),
      servers: servers.map(s => ({
        id: s.id,
        host: s.host,
        port: s.port,
        connections: s.connections,
        healthy: s.healthy,
        utilizationPercent: Math.round((s.connections / s.maxConnections) * 100)
      }))
    };
  }
}

module.exports = WebSocketLoadBalancer;
```

## Security Considerations

### 1. Input Validation and Sanitization

```javascript
// security/message-validator.js
const Joi = require('joi');
const DOMPurify = require('isomorphic-dompurify');

class MessageValidator {
  constructor() {
    this.schemas = new Map();
    this.initializeSchemas();
  }
  
  initializeSchemas() {
    // Chat message schema
    this.schemas.set('chat_message', Joi.object({
      content: Joi.string().max(1000).required(),
      roomId: Joi.string().uuid().required(),
      type: Joi.string().valid('text', 'emoji', 'file').default('text'),
      metadata: Joi.object({
        mentions: Joi.array().items(Joi.string().uuid()).max(10),
        attachments: Joi.array().items(Joi.object({
          type: Joi.string().valid('image', 'file').required(),
          url: Joi.string().uri().required(),
          size: Joi.number().max(10485760) // 10MB
        })).max(5)
      }).optional()
    }));
    
    // Room join schema
    this.schemas.set('room_join', Joi.object({
      roomId: Joi.string().uuid().required(),
      password: Joi.string().max(100).optional()
    }));
    
    // User status update schema
    this.schemas.set('status_update', Joi.object({
      status: Joi.string().valid('online', 'away', 'busy', 'offline').required(),
      message: Joi.string().max(200).optional()
    }));
  }
  
  validateMessage(type, payload) {
    const schema = this.schemas.get(type);
    if (!schema) {
      throw new Error(`No validation schema for message type: ${type}`);
    }
    
    const { error, value } = schema.validate(payload);
    if (error) {
      throw new Error(`Validation error: ${error.details[0].message}`);
    }
    
    return this.sanitizePayload(type, value);
  }
  
  sanitizePayload(type, payload) {
    switch (type) {
      case 'chat_message':
        return this.sanitizeChatMessage(payload);
      default:
        return payload;
    }
  }
  
  sanitizeChatMessage(payload) {
    // Sanitize HTML content
    if (payload.content) {
      payload.content = DOMPurify.sanitize(payload.content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u'],
        ALLOWED_ATTR: []
      });
    }
    
    // Validate and sanitize URLs in attachments
    if (payload.metadata?.attachments) {
      payload.metadata.attachments = payload.metadata.attachments.map(attachment => ({
        ...attachment,
        url: this.sanitizeUrl(attachment.url)
      }));
    }
    
    return payload;
  }
  
  sanitizeUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Only allow specific protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid URL protocol');
      }
      
      // Block internal/private IP ranges
      const hostname = parsedUrl.hostname;
      if (this.isPrivateIP(hostname)) {
        throw new Error('Private IP addresses not allowed');
      }
      
      return parsedUrl.toString();
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }
  
  isPrivateIP(hostname) {
    // Check for private IP ranges
    const privateRanges = [
      /^127\./, // 127.0.0.0/8
      /^10\./, // 10.0.0.0/8
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
      /^192\.168\./, // 192.168.0.0/16
      /^169\.254\./, // 169.254.0.0/16 (link-local)
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 unique local
      /^fe80:/ // IPv6 link-local
    ];
    
    return privateRanges.some(range => range.test(hostname));
  }
}

module.exports = MessageValidator;
```

### 2. Rate Limiting

```javascript
// security/rate-limiter.js
const Redis = require('redis');

class RateLimiter {
  constructor(redisClient, options = {}) {
    this.redis = redisClient;
    this.windowSize = options.windowSize || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.keyPrefix = options.keyPrefix || 'rate_limit:';
  }
  
  async checkRateLimit(identifier, options = {}) {
    const windowSize = options.windowSize || this.windowSize;
    const maxRequests = options.maxRequests || this.maxRequests;
    const key = `${this.keyPrefix}${identifier}`;
    
    const now = Date.now();
    const windowStart = now - windowSize;
    
    // Use Redis sorted set for sliding window
    const multi = this.redis.multi();
    
    // Remove expired entries
    multi.zRemRangeByScore(key, 0, windowStart);
    
    // Count current requests
    multi.zCard(key);
    
    // Add current request
    multi.zAdd(key, now, `${now}-${Math.random()}`);
    
    // Set expiration
    multi.expire(key, Math.ceil(windowSize / 1000));
    
    const results = await multi.exec();
    const currentCount = results[1][1];
    
    if (currentCount >= maxRequests) {
      return {
        allowed: false,
        count: currentCount,
        resetTime: now + windowSize,
        retryAfter: Math.ceil(windowSize / 1000)
      };
    }
    
    return {
      allowed: true,
      count: currentCount + 1,
      remaining: maxRequests - currentCount - 1,
      resetTime: now + windowSize
    };
  }
  
  async getRateLimitStatus(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    const now = Date.now();
    const windowStart = now - this.windowSize;
    
    // Count requests in current window
    const count = await this.redis.zCount(key, windowStart, now);
    
    return {
      count,
      remaining: Math.max(0, this.maxRequests - count),
      resetTime: now + this.windowSize
    };
  }
  
  async resetRateLimit(identifier) {
    const key = `${this.keyPrefix}${identifier}`;
    await this.redis.del(key);
  }
}

module.exports = RateLimiter;
```

## Testing Strategies

### 1. WebSocket Testing

```javascript
// tests/websocket.test.js
const WebSocket = require('ws');
const { createServer } = require('http');
const WebSocketServer = require('../websocket/server');

describe('WebSocket Server', () => {
  let server;
  let wsServer;
  let port;
  
  beforeAll((done) => {
    server = createServer();
    wsServer = new WebSocketServer(server);
    
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  describe('Connection Management', () => {
    it('should accept valid WebSocket connections', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`, {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });
      
      ws.on('error', done);
    });
    
    it('should reject connections without valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      ws.on('open', () => {
        done(new Error('Connection should have been rejected'));
      });
    });
  });
  
  describe('Message Handling', () => {
    let ws;
    
    beforeEach((done) => {
      ws = new WebSocket(`ws://localhost:${port}/ws`, {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });
      
      ws.on('open', done);
    });
    
    afterEach(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    it('should handle ping/pong messages', (done) => {
      const pingMessage = {
        id: '123',
        type: 'ping',
        timestamp: new Date().toISOString(),
        payload: { timestamp: Date.now() }
      };
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'pong') {
          expect(message.metadata.correlation_id).toBe('123');
          done();
        }
      });
      
      ws.send(JSON.stringify(pingMessage));
    });
    
    it('should validate message format', (done) => {
      const invalidMessage = {
        // Missing required fields
        payload: { test: 'data' }
      };
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        
        if (message.type === 'error') {
          expect(message.payload.error).toContain('Invalid message format');
          done();
        }
      });
      
      ws.send(JSON.stringify(invalidMessage));
    });
  });
});
```

### 2. Load Testing

```javascript
// tests/load/websocket-load.test.js
const WebSocket = require('ws');

describe('WebSocket Load Tests', () => {
  const SERVER_URL = process.env.WS_SERVER_URL || 'ws://localhost:3000/ws';
  const TOKEN = process.env.TEST_TOKEN || 'test-token';
  
  it('should handle 100 concurrent connections', async () => {
    const connections = [];
    const connectionPromises = [];
    
    // Create 100 connections
    for (let i = 0; i < 100; i++) {
      const promise = new Promise((resolve, reject) => {
        const ws = new WebSocket(`${SERVER_URL}?token=${TOKEN}`);
        
        ws.on('open', () => {
          connections.push(ws);
          resolve(ws);
        });
        
        ws.on('error', reject);
      });
      
      connectionPromises.push(promise);
    }
    
    // Wait for all connections
    const connectedSockets = await Promise.all(connectionPromises);
    expect(connectedSockets).toHaveLength(100);
    
    // Send messages from all connections
    const messagePromises = connectedSockets.map((ws, index) => {
      return new Promise((resolve) => {
        const message = {
          id: `load-test-${index}`,
          type: 'chat_message',
          timestamp: new Date().toISOString(),
          payload: {
            content: `Load test message ${index}`,
            roomId: 'load-test-room'
          }
        };
        
        ws.send(JSON.stringify(message));
        
        // Wait for response or timeout
        setTimeout(resolve, 1000);
      });
    });
    
    await Promise.all(messagePromises);
    
    // Close all connections
    connections.forEach(ws => ws.close());
  }, 30000);
  
  it('should maintain performance under message load', async () => {
    const MESSAGE_COUNT = 1000;
    const CONCURRENT_SENDERS = 10;
    
    // Create sender connections
    const senders = [];
    for (let i = 0; i < CONCURRENT_SENDERS; i++) {
      const ws = new WebSocket(`${SERVER_URL}?token=${TOKEN}`);
      await new Promise(resolve => ws.on('open', resolve));
      senders.push(ws);
    }
    
    // Create receiver connection
    const receiver = new WebSocket(`${SERVER_URL}?token=${TOKEN}`);
    await new Promise(resolve => receiver.on('open', resolve));
    
    let receivedMessages = 0;
    const startTime = Date.now();
    
    receiver.on('message', () => {
      receivedMessages++;
    });
    
    // Send messages concurrently
    const sendPromises = senders.map((ws, senderIndex) => {
      return Promise.all(
        Array.from({ length: MESSAGE_COUNT / CONCURRENT_SENDERS }, (_, i) => {
          const message = {
            id: `perf-test-${senderIndex}-${i}`,
            type: 'chat_message',
            timestamp: new Date().toISOString(),
            payload: {
              content: `Performance test message ${senderIndex}-${i}`,
              roomId: 'perf-test-room'
            }
          };
          
          ws.send(JSON.stringify(message));
          
          // Small delay to avoid overwhelming
          return new Promise(resolve => setTimeout(resolve, 10));
        })
      );
    });
    
    await Promise.all(sendPromises);
    
    // Wait for messages to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const messagesPerSecond = MESSAGE_COUNT / (duration / 1000);
    
    expect(messagesPerSecond).toBeGreaterThan(100); // Expect at least 100 msg/sec
    
    // Clean up
    [...senders, receiver].forEach(ws => ws.close());
  }, 60000);
});
```

This comprehensive WebSocket and real-time communication patterns document provides a complete framework for
implementing scalable, secure, and maintainable real-time features in REST-Base applications.
