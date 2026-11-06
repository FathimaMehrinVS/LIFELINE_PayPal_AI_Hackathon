import { createApp } from "./app";
import { env } from "./config/env";

createApp().listen(env.PORT, () => {
  console.log(`LIFELINE API listening on http://localhost:${env.PORT}`);
});
