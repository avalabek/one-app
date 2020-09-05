import express from 'express';
import socketio from 'socket.io';
import http from 'http';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import protobuf from 'protobufjs';

import protoDescriptor from '../../../chaos-gui/src/service.proto.json';


export default function createGrpcServer() {
  let protoDefs;
  const creds = credentials.createInsecure();
  let client;

  function addClient(message) {
    console.log('chaos orchesatrator calling add client.');
    client.addClient(message, (err, orchestratorNodeconfig) => {
      console.log('chaos orchesatrator returned.');
      if (err) console.error('call to grpc server for add client failed', err);
      else console.log('recieved the resulting node config.', orchestratorNodeconfig);
    });
  }

  function intertangle(message) {
    const server = client.intertangle(message);
    server.on('data', console.log);
    server.on('end', console.log);
    server.on('error', console.log);
    server.on('status', console.log);
    server.write(message);
    server.end();
  }

  function getProtoDefintion(path) {
    const packageDefinition = loadSync(
      path,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      });
    return packageDefinition;
  }

  function loadGrpcClient() {
    const packageDefinition = getProtoDefintion(`${__dirname}../../../../../../chaos.engine/src/main/proto/service.proto`);
    protoDefs = loadPackageDefinition(packageDefinition);
    client = new protoDefs.ChaosOrchestrator('localhost:62223', creds);
  }


  const app = express();
  const httpServer = http.createServer(app);
  const socket = socketio(httpServer);
  const serviceDescriptor = protobuf.Root.fromJSON(protoDescriptor);
  loadGrpcClient();

  console.log('Starting GRPC Proxy Server...');

  socket.on('connection', (io) => {
    console.log('New connection established');
    io.on('alive', console.log);
    io.on('error', (err) => console.error(`WebSocket Error: ${err.message}`));

    const service = 'ChaosOrchestrator';

    io.on(`${service}.addClient`, (data) => {
      const newClient = data;
      
      addClient(newClient);
    });
  });
  socket.on('error', (err) => console.error(`WebSocket Error: ${err.message}`));
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  return httpServer;
}
