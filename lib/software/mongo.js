import { MongoClient } from 'mongodb';
const g = globalThis;

export async function invoices() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!g.__swMongo) {
    g.__swMongo = (async () => {
      const client = await new MongoClient(process.env.MONGODB_URI).connect();
      const db = client.db(process.env.MONGODB_DB || 'licenseledger');
      try {
        await db.createCollection('invoices', {
          validator: { $jsonSchema: {
            bsonType: 'object',
            required: ['subscription_id', 'vendor_id', 'invoice_date', 'total', 'currency'],
            properties: {
              subscription_id: { bsonType: ['int', 'long', 'double'] },
              vendor_id: { bsonType: ['int', 'long', 'double'] },
              invoice_date: { bsonType: 'date' },
              total: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 },
              currency: { bsonType: 'string', minLength: 3, maxLength: 3 },
              line_items: { bsonType: 'array' }
            }
          } }
        });
      } catch (e) { if (e.code !== 48) throw e; } // 48 = already exists
      const col = db.collection('invoices');
      await col.createIndex({ subscription_id: 1, invoice_date: -1 });
      await col.createIndex({ vendor_id: 1, invoice_date: -1 });
      return col;
    })();
  }
  return g.__swMongo;
}
