export const BATCH_SIZE_OPTIONS = [1, 2, 4, 8] as const;
export const DEFAULT_BATCH_SIZE = 2;

type BatchResult<T, TResult> = {
  index: number;
  item: T;
  result: TResult;
};

export function normalizeBatchSize(value: number) {
  const sanitized = Math.trunc(value);

  if (!Number.isFinite(sanitized) || sanitized < 1) {
    return DEFAULT_BATCH_SIZE;
  }

  return sanitized;
}

export function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function mapInBatches<T, TResult>(
  items: T[],
  batchSize: number,
  mapItem: (item: T, index: number) => Promise<TResult>,
  onBatchResolved?: (results: Array<BatchResult<T, TResult>>) => void,
) {
  const resolvedBatchSize = normalizeBatchSize(batchSize);
  const results = new Array<TResult>(items.length);

  for (let startIndex = 0; startIndex < items.length; startIndex += resolvedBatchSize) {
    const batch = items.slice(startIndex, startIndex + resolvedBatchSize);

    await yieldToBrowser();

    const batchResults = await Promise.all(
      batch.map(async (item, batchOffset) => {
        const index = startIndex + batchOffset;
        const result = await mapItem(item, index);
        results[index] = result;

        return {
          index,
          item,
          result,
        };
      }),
    );

    onBatchResolved?.(batchResults);
  }

  return results;
}
