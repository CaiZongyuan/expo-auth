let inFlightRefresh: Promise<string> | null = null;

export async function runRefreshSingleFlight(task: () => Promise<string>): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = task().finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}

