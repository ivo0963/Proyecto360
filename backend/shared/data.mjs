// Persistencia en Amazon DynamoDB (base de datos cloud).
// Tablas (clave de partición "id", tipo String):
//   CATALOG_TABLE (p360-catalog) y ORDERS_TABLE (p360-orders)
// El AWS SDK v3 viene incluido en el runtime de Lambda (nodejs18.x+): no hay que empaquetarlo.
import { randomUUID } from 'node:crypto';

const CATALOG_TABLE = process.env.CATALOG_TABLE ?? 'p360-catalog';
const ORDERS_TABLE = process.env.ORDERS_TABLE ?? 'p360-orders';

// Productos iniciales: se cargan solo si la tabla está vacía.
export const SEED_CATALOG = [
  { id: 'p1', name: 'Teclado mecánico', price: 45990, stock: 25 },
  { id: 'p2', name: 'Mouse inalámbrico', price: 19990, stock: 60 },
  { id: 'p3', name: 'Monitor 24"', price: 129990, stock: 12 },
];

export class ConflictError extends Error {}

let docClient; // se crea una vez y se reutiliza entre invocaciones
let sdk;
async function db() {
  if (!docClient) {
    const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
    sdk = await import('@aws-sdk/lib-dynamodb');
    docClient = sdk.DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return { client: docClient, cmd: sdk };
}

async function scanAll(TableName) {
  const { client, cmd } = await db();
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await client.send(new cmd.ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

const dynamoRepo = {
  async listCatalog() {
    let items = await scanAll(CATALOG_TABLE);
    if (items.length === 0) {
      const { client, cmd } = await db();
      await client.send(
        new cmd.BatchWriteCommand({
          RequestItems: {
            [CATALOG_TABLE]: SEED_CATALOG.map((Item) => ({ PutRequest: { Item } })),
          },
        }),
      );
      items = SEED_CATALOG;
    }
    return items.sort((a, b) => a.id.localeCompare(b.id));
  },

  async getProduct(id) {
    const { client, cmd } = await db();
    const res = await client.send(new cmd.GetCommand({ TableName: CATALOG_TABLE, Key: { id } }));
    return res.Item ?? null;
  },

  // Actualiza solo los campos presentes. Devuelve null si el producto no existe.
  async updateProduct(id, changes) {
    const { client, cmd } = await db();
    const names = {};
    const values = {};
    const sets = Object.entries(changes).map(([k, v], i) => {
      names[`#f${i}`] = k;
      values[`:v${i}`] = v;
      return `#f${i} = :v${i}`;
    });
    if (sets.length === 0) return this.getProduct(id);
    try {
      const res = await client.send(
        new cmd.UpdateCommand({
          TableName: CATALOG_TABLE,
          Key: { id },
          UpdateExpression: `SET ${sets.join(', ')}`,
          ConditionExpression: 'attribute_exists(id)',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: 'ALL_NEW',
        }),
      );
      return res.Attributes;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') return null;
      throw err;
    }
  },

  async listOrders(owner) {
    const items = await scanAll(ORDERS_TABLE);
    return items
      .filter((o) => owner == null || o.owner === owner)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // Descuenta stock y guarda el pedido en UNA transacción: o pasan ambas o ninguna.
  async createOrder({ owner, product, qty }) {
    const { client, cmd } = await db();
    const order = {
      id: randomUUID(),
      owner,
      productId: product.id,
      productName: product.name,
      qty,
      total: product.price * qty,
      status: 'CREADO',
      createdAt: new Date().toISOString(),
    };
    try {
      await client.send(
        new cmd.TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: CATALOG_TABLE,
                Key: { id: product.id },
                UpdateExpression: 'SET stock = stock - :q',
                ConditionExpression: 'stock >= :q',
                ExpressionAttributeValues: { ':q': qty },
              },
            },
            { Put: { TableName: ORDERS_TABLE, Item: order } },
          ],
        }),
      );
    } catch (err) {
      if (err.name === 'TransactionCanceledException') throw new ConflictError('Stock insuficiente');
      throw err;
    }
    return order;
  },
};

let repo = dynamoRepo;
export const data = new Proxy({}, { get: (_t, prop) => repo[prop].bind(repo) });

// Solo para pruebas: reemplaza DynamoDB por un repositorio en memoria.
export function __setRepo(fake) {
  repo = fake;
}
