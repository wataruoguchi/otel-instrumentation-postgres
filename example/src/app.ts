import { faker } from "@faker-js/faker";
import { Hono } from "hono";
import type { DBClient } from "./infrastructure/database.js";

function getApp(db: DBClient) {
  const app = new Hono();

  app.get("/", async (c) => {
    await db.schema
      .createTable("products")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text")
      .addColumn("price", "integer")
      .execute();
    return c.redirect("/products");
  });
  app.get("/products", async (c) => {
    const products = await db.selectFrom("products").selectAll().execute();
    return c.json(products);
  });
  app.get("/products/create-more", async (c) => {
    const products = Array.from({ length: 100 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: faker.number.int({ min: 100, max: 1000 }),
    }));
    await db.insertInto("products").values(products).execute();
  });
  return app;
}

export { getApp };
