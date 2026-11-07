// Covers the marketplace checkout flow's money/stock correctness — the
// scenarios manually curl-tested during the marketplace.js migration,
// made permanent here.
const { resetDb, makeAuthedUser, mockReq, mockRes, makeChecker } = require("../helpers/testHarness");

const db = resetDb();
const wallet = require("../../src/http/walletController");
const marketplace = require("../../src/http/marketplaceController");
const { check, finish } = makeChecker();

async function run() {
  const owner = makeAuthedUser(db, { phone: "+2340003330001", name: "Owner", role: "station_owner" });
  const buyer = makeAuthedUser(db, { phone: "+2340003330002", name: "Buyer", role: "driver" });

  const topupRes = mockRes();
  await wallet.topupWallet(mockReq(buyer.token, { amount: 1000 }), topupRes);
  check("buyer tops up wallet with 1000", topupRes.statusCode === 200 && topupRes.body.balance === 1000);

  const wrongRoleRes = mockRes();
  await marketplace.createProduct(mockReq(buyer.token, { name: "X", category: "cables", price: 100 }), wrongRoleRes);
  check("driver CANNOT list a product (403)", wrongRoleRes.statusCode === 403);

  const productRes = mockRes();
  await marketplace.createProduct(
    mockReq(owner.token, { name: "Cable", category: "cables", price: 500, stock_qty: 3 }),
    productRes
  );
  check("owner creates a product with stock 3 (201)", productRes.statusCode === 201);
  const productId = productRes.body.id;

  const overStockRes = mockRes();
  await marketplace.createOrder(mockReq(buyer.token, { product_id: productId, qty: 10 }), overStockRes);
  check("ordering more than in stock is rejected (400)", overStockRes.statusCode === 400);

  const orderRes = mockRes();
  await marketplace.createOrder(mockReq(buyer.token, { product_id: productId, qty: 2 }), orderRes);
  check("legitimate order succeeds (201)", orderRes.statusCode === 201);
  check("order charged the exact total (1000)", orderRes.body.total === 1000);
  check("exactly 10 loyalty points earned (1% of 1000)", orderRes.body.points_earned === 10);
  check("wallet balance correctly at 0 after", orderRes.body.wallet_balance === 0);

  const stockAfter = db.prepare(`SELECT stock_qty FROM marketplace_products WHERE id = ?`).get(productId);
  check("stock correctly decremented from 3 to 1", stockAfter.stock_qty === 1);

  const insufficientRes = mockRes();
  await marketplace.createOrder(mockReq(buyer.token, { product_id: productId, qty: 1 }), insufficientRes);
  check("next order correctly fails on insufficient balance (402)", insufficientRes.statusCode === 402);

  const crossUpdateRes = mockRes();
  await marketplace.updateProduct(mockReq(buyer.token, { price: 1 }), crossUpdateRes, productId);
  check("buyer CANNOT update owner's product (403)", crossUpdateRes.statusCode === 403);

  finish();
}

run();
