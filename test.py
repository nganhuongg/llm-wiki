import asyncio
import cognee

async def main():
    await cognee.remember(
        "MC50 focuses on communication and evidence."
    )

    results = await cognee.recall(
        "What does MC50 focus on?"
    )

    print(results)

asyncio.run(main())