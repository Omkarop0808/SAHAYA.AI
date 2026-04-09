# System design interview patterns

Interviewers often probe **scalability**, **consistency vs availability (CAP)**, and **data modeling**.

Common motifs: load balancers, caching (CDN, Redis), sharding, replication, message queues for async work, idempotency for retries.

For storage: choose SQL when you need transactions and joins; choose NoSQL for flexible schemas or horizontal scale with simple access patterns.

Always clarify **traffic**, **latency targets**, and **failure modes** before deep diving.
