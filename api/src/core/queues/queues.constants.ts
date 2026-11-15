export const BULL_BOARD_ADAPTER = 'BULL_BOARD_ADAPTER';

/** 11 Communication Center: one job per outbound CommMessage send (first send of scheduled / campaign messages, and every retry). */
export const COMM_MESSAGES_QUEUE = 'comm-messages';
/** 11 Communication Center: campaign steps (start a run, release the A/B winner, finalize) and the reconciliation sweep. */
export const COMM_CAMPAIGNS_QUEUE = 'comm-campaigns';

/** Every queue of the app, registered once here so producers, workers and Bull Board share them. */
export const QUEUE_NAMES = [COMM_MESSAGES_QUEUE, COMM_CAMPAIGNS_QUEUE] as const;
