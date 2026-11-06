# Channel3 product discovery — Member 3

The adapter is implemented in `apps/api/src/modules/commerce/product-source.ts` as `Channel3Source`, alongside
the `ProductSource` interface. It calls `POST https://api.trychannel3.com/v1/search` from the API server with
the `x-api-key` header and requested currency. The key is read from `CHANNEL3_API_KEY`; it is never sent to the
web app. The Channel3 guide documents this endpoint, server-side key header and paginated product results:
<https://github.com/channel3-ai/skills/blob/main/skills/channel3-api/SKILL.md>.

Results are normalized only when a product has a usable title, a positive price in the requested currency, a
recognized need category and a merchant offer. They are labelled `source: "channel3"`, `availability: "unknown"`
and `price_label: "estimate"`. Product links are optional and may expire; confirm price and availability with
the retailer before purchase. An online catalogue does not establish local stock or a business relationship.

If `CHANNEL3_API_KEY` is absent, the source returns an empty list without a network call. HTTP errors, malformed
responses and timeouts also degrade to an empty list. The composite source always includes the 25-product local
synthetic registry, so Channel3 availability is optional for basket creation.
