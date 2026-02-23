import { Router } from 'express';
import { createAgent, getAgents, getAgentById, updateAgent, updateAgentStatus, deleteAgent, createSubAgent, getSubAgents, getSubAgentById, updateSubAgent, deleteSubAgent } from '../controllers/agent.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
const agentRouter = Router();

agentRouter.post('/', authenticate, createAgent);
agentRouter.get('/', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'accounts_manager'), getAgents);
agentRouter.get('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise', 'accounts_manager'), getAgentById);
agentRouter.put('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), updateAgent);
agentRouter.delete('/:id', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), deleteAgent);
agentRouter.put('/:id/status', authenticate, requireRole('super_admin', 'regional_manager', 'relationship_manager', 'franchise'), updateAgentStatus);

// Sub-agent routes (for agents only)
agentRouter.post('/sub-agents', authenticate, requireRole('agent'), createSubAgent);
agentRouter.get('/sub-agents', authenticate, requireRole('agent'), getSubAgents);
agentRouter.get('/sub-agents/:id', authenticate, requireRole('agent'), getSubAgentById);
agentRouter.put('/sub-agents/:id', authenticate, requireRole('agent'), updateSubAgent);
agentRouter.delete('/sub-agents/:id', authenticate, requireRole('agent'), deleteSubAgent);

export default agentRouter;