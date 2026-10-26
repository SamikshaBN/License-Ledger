// One-time repair for a database where the invoice validator is missing and junk documents were inserted.
// Run:  docker compose exec -T mongo mongosh licenseledger < docs\demo\mongo_repair.js
db = db.getSiblingDB('licenseledger');

print('--- 1. documents that should not exist (missing fields or a negative total) ---');
db.invoices.find({ $or: [
  { vendor_name: { $exists: false } }, { invoice_date: { $exists: false } },
  { subscription_id: { $exists: false } }, { total: { $not: { $gte: 0 } } } ] },
  { invoice_number: 1, total: 1, vendor_name: 1 }).forEach(printjson);

print('--- 2. delete them ---');
printjson(db.invoices.deleteMany({ $or: [
  { vendor_name: { $exists: false } }, { invoice_date: { $exists: false } },
  { subscription_id: { $exists: false } }, { total: { $not: { $gte: 0 } } } ] }));

print('--- 3. attach the validator to the existing collection ---');
printjson(db.runCommand({
  collMod: 'invoices', validationLevel: 'strict', validationAction: 'error',
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['subscription_id', 'vendor_id', 'invoice_date', 'total', 'currency'],
    properties: {
      subscription_id: { bsonType: ['int', 'long', 'double'] },
      vendor_id: { bsonType: ['int', 'long', 'double'] },
      invoice_date: { bsonType: 'date' },
      total: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 },
      currency: { bsonType: 'string', minLength: 3, maxLength: 3 },
      line_items: { bsonType: 'array' } } } } }));

print('--- 4. check: both inserts below must now print REJECTED ---');
try { db.invoices.insertOne({ subscription_id: 1, vendor_id: 1, invoice_date: new Date(), total: -5, currency: 'INR' }); print('NOT REJECTED: validator is not working'); }
catch (e) { print('REJECTED: ' + e.codeName + ' (code ' + e.code + ')'); }
try { db.invoices.insertOne({ invoice_number: 'NO-FIELDS' }); print('NOT REJECTED: validator is not working'); }
catch (e) { print('REJECTED: ' + e.codeName + ' (code ' + e.code + ')'); }
print('validator active: ' + !!db.getCollectionInfos({ name: 'invoices' })[0].options.validator);
print('documents now: ' + db.invoices.countDocuments());
