import { MongoClient } from 'mongodb';
const g = globalThis;

// Shape every invoice must have. Vendor-specific data lives in raw_payload and is not restricted.
export const INVOICE_VALIDATOR = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['subscription_id', 'vendor_id', 'invoice_date', 'total', 'currency'],
    properties: {
      subscription_id: { bsonType: ['int', 'long', 'double'] },
      vendor_id: { bsonType: ['int', 'long', 'double'] },
      invoice_date: { bsonType: 'date' },
      total: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 },
      currency: { bsonType: 'string', minLength: 3, maxLength: 3 },
      line_items: { bsonType: 'array' },
    },
  },
};

// Connects once, makes sure the collection has its validator and indexes, and returns it.
// Used by the API routes and by scripts/seed-software.js, so the collection is always created the same way.
export async function invoices() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  if (!g.__swMongo) {
    g.__swMongo = (async () => {
      const client = await new MongoClient(process.env.MONGODB_URI).connect();
      const db = client.db(process.env.MONGODB_DB || 'licenseledger');
      try {
        await db.createCollection('invoices', { validator: INVOICE_VALIDATOR });
      } catch (e) {
        if (e.code !== 48) throw e; // 48 = collection already exists
        // It may have been created by a plain insert before the validator existed: attach the validator now.
        try {
          await db.command({ collMod: 'invoices', validator: INVOICE_VALIDATOR, validationLevel: 'strict', validationAction: 'error' });
        } catch (err) { console.warn('Could not attach the invoice validator:', err.message); }
      }
      const col = db.collection('invoices');
      await col.createIndex({ subscription_id: 1, invoice_date: -1 });
      await col.createIndex({ vendor_id: 1, invoice_date: -1 });
      try { // the same invoice number cannot be uploaded twice for one subscription
        await col.createIndex({ subscription_id: 1, invoice_number: 1 },
          { unique: true, partialFilterExpression: { invoice_number: { $type: 'string' } } });
      } catch (err) { console.warn('Could not create the unique invoice-number index:', err.message); }
      return col;
    })().catch((e) => { g.__swMongo = null; throw e; }); // do not cache a failed connection
  }
  return g.__swMongo;
}
