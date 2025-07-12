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
  app.get("/products/add-more", async (c) => {
    const products = Array.from({ length: 3 }, () => ({
      id: faker.string.uuid(),
      name: faker.commerce.productName(),
      price: faker.number.int({ min: 100, max: 1000 }),
    }));
    await db.insertInto("products").values(products).execute();
    return c.redirect("/products");
  });
  app.get("/products/delete-all", async (c) => {
    await db.deleteFrom("products").execute();
    return c.redirect("/products");
  });
  app.get("/products/sql-error", async (c) => {
    try {
      // @ts-expect-error - This is a test error
      await db.selectFrom("table_that_does_not_exist").selectAll().execute();
    } catch (_e) {}
    return c.json({ message: "SQL error" });
  });
  return app;
}

export { getApp };
