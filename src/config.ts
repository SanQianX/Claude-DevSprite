import * as path from 'path';

export const config = {
  port: 38888,
  dbPath: path.join(__dirname, '../data/dev-sprite.db'),
  knowledgeRoot: process.env.KNOWLEDGE_ROOT || path.join(__dirname, '../test-data/knowledge-base'),
};
