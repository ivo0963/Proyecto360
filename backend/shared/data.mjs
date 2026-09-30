// Datos en memoria SOLO para el ejercicio (se reinician en cada cold start).
// En producción irían en DynamoDB / RDS.
export const catalog = [
  { id: 'p1', name: 'Teclado mecánico', price: 45990, stock: 25 },
  { id: 'p2', name: 'Mouse inalámbrico', price: 19990, stock: 60 },
  { id: 'p3', name: 'Monitor 24"', price: 129990, stock: 12 },
];

export const orders = [];
