import { Router } from 'express';
import { createAgent, getAgents, getAgentById, updateAgent, updateAgentStatus, deleteAgent } from '../controllers/agent.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
const agentRouter = Router();

agentRouter.post('/', authenticate, createAgent);
agentRouter.get('/', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), getAgents);
agentRouter.get('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), getAgentById);
agentRouter.put('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), updateAgent);
agentRouter.delete('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), deleteAgent);
agentRouter.put('/:id/status', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), updateAgentStatus);


export default agentRouter;