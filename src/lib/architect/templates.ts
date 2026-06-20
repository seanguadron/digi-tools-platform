import type {
  ArchitectEdge,
  ArchitectEdgeKind,
  ArchitectGroup,
  ArchitectNode,
  ArchitectProject,
  BlockType,
  DataField,
} from "@/lib/architect/types";

export type ArchitectTemplateId = "notion" | "kanban" | "streaming";

export type ArchitectTemplate = {
  id: ArchitectTemplateId;
  label: string;
  project: ArchitectProject;
};

function field(
  owner: string,
  name: string,
  type: string,
  description = "",
): DataField {
  return { id: `${owner}.${name}`, name, type, description };
}

function group(id: string, name: string): ArchitectGroup {
  return { id, name };
}

function node(
  id: string,
  type: BlockType,
  name: string,
  description: string,
  position: { x: number; y: number },
  responsibilities: string[] = [],
  fields: DataField[] = [],
  extra: {
    goal?: string;
    notes?: string;
    dataNotes?: string;
    openQuestions?: string;
    groupId?: string;
  } = {},
): ArchitectNode {
  return {
    id,
    type,
    name,
    goal: extra.goal ?? "",
    description,
    responsibilities,
    fields,
    dataNotes: extra.dataNotes ?? "",
    notes: extra.notes ?? "",
    openQuestions: extra.openQuestions ?? "",
    groupId: extra.groupId,
    position,
  };
}

function edge(
  source: string,
  target: string,
  kind: ArchitectEdgeKind = "uses",
  label = "",
): ArchitectEdge {
  return {
    id: `${source}-${kind}-${target}`,
    source,
    target,
    kind,
    label: label || undefined,
  };
}

// Three column origins so each subsystem's members cluster into a tidy box.
const COL = [60, 400, 740, 1080];
const row = (i: number) => 60 + i * 185;

// ============================================================================
// Doc Workspace (Notion-lite) — block-based pages with real-time collaboration
// ============================================================================
const NOTION: ArchitectProject = {
  version: 2,
  systemName: "Doc Workspace",
  systemGoal:
    "A block-based document workspace where teams build pages out of typed blocks and edit them together in real time.",
  groups: [
    group("g-edit", "Editing & collaboration"),
    group("g-blocks", "Block model"),
    group("g-infra", "Storage & search"),
  ],
  nodes: [
    node(
      "ws-manager",
      "manager",
      "WorkspaceManager",
      "Owns the workspace: its pages, members, and sharing rules.",
      { x: COL[0], y: row(0) },
      [
        "Create, move, and archive pages",
        "Manage members and their roles",
        "Enforce who may view or edit a page",
      ],
      [],
      {
        groupId: "g-edit",
        goal: "Be the single authority for what exists in a workspace and who may touch it.",
        openQuestions:
          "Are permissions enforced per page, per block, or both?\nDo we support public share links, and how are they revoked?",
      },
    ),
    node(
      "page-service",
      "service",
      "PageService",
      "Loads and saves a page and its tree of blocks.",
      { x: COL[0], y: row(1) },
      [
        "Load a page's full block tree",
        "Insert, move, and delete blocks",
        "Keep the tree valid (no orphans or cycles)",
      ],
      [],
      {
        groupId: "g-edit",
        goal: "Turn a stored page into an editable tree of blocks and back again.",
      },
    ),
    node(
      "collab-service",
      "service",
      "CollabService",
      "Runs a live editing session and broadcasts changes to everyone on the page.",
      { x: COL[0], y: row(2) },
      [
        "Open and close editing sessions",
        "Broadcast block changes to all viewers",
        "Track presence and cursor positions",
      ],
      [],
      {
        groupId: "g-edit",
        goal: "Let many people edit the same page at once without overwriting each other.",
      },
    ),
    node(
      "crdt-worker",
      "worker",
      "CrdtSyncWorker",
      "Merges concurrent edits into one consistent document using a CRDT.",
      { x: COL[0], y: row(3) },
      [
        "Apply local and remote operations",
        "Resolve conflicting edits deterministically",
        "Compact long operation histories",
      ],
      [],
      {
        groupId: "g-edit",
        goal: "Guarantee every client converges on the same document, offline edits included.",
        openQuestions:
          "Which CRDT library — Yjs or Automerge?\nHow do we bound memory and history for very large or long-lived pages?",
      },
    ),
    node(
      "page",
      "data",
      "Page",
      "A single page record.",
      { x: COL[0], y: row(4) },
      [],
      [
        field("page", "id", "ID", "Primary key"),
        field("page", "workspaceId", "ID", "Owning workspace"),
        field("page", "title", "string", "Page title"),
        field("page", "icon", "string", "Emoji or icon ref"),
        field("page", "rootBlockId", "ID", "Top of the block tree"),
        field("page", "archived", "boolean", "Soft-delete flag"),
        field("page", "updatedAt", "timestamp", "Last edit time"),
      ],
      {
        groupId: "g-edit",
        goal: "Be the addressable unit users open, share, and search.",
      },
    ),

    node(
      "block",
      "base",
      "Block",
      "The abstract content unit every concrete block derives from.",
      { x: COL[1], y: row(0) },
      [
        "Hold tree position (parent + order)",
        "Carry the block's type tag",
        "Serialize to and from storage",
      ],
      [
        field("block", "id", "ID", "Primary key"),
        field("block", "pageId", "ID", "Owning page"),
        field("block", "parentId", "ID", "Parent block (null at root)"),
        field("block", "order", "string", "Fractional index among siblings"),
        field("block", "type", "enum", "text | table | image | …"),
        field("block", "content", "JSON", "Type-specific payload"),
      ],
      {
        groupId: "g-blocks",
        goal: "Define the one tree shape — id, parent, order, type — that every block kind shares.",
        dataNotes:
          "Blocks form a tree; `order` is a fractional index so inserting between siblings never renumbers them.",
      },
    ),
    node(
      "text-block",
      "worker",
      "TextBlock",
      "A rich-text paragraph or heading.",
      { x: COL[1], y: row(1) },
      ["Store inline marks (bold, link, code)", "Support heading levels"],
      [],
      {
        groupId: "g-blocks",
        goal: "Render and edit formatted inline text.",
      },
    ),
    node(
      "table-block",
      "worker",
      "TableBlock",
      "A grid of rows and cells.",
      { x: COL[1], y: row(2) },
      ["Manage rows and columns", "Store per-cell content"],
      [],
      {
        groupId: "g-blocks",
        goal: "Hold tabular data inside a page.",
      },
    ),
    node(
      "image-block",
      "worker",
      "ImageBlock",
      "An embedded image with caption and sizing.",
      { x: COL[1], y: row(3) },
      ["Reference a stored asset", "Hold caption and dimensions"],
      [],
      {
        groupId: "g-blocks",
        goal: "Embed and display a stored image inline.",
      },
    ),

    node(
      "block-store",
      "adapter",
      "BlockStore",
      "Persists pages and block trees to the database.",
      { x: COL[2], y: row(0) },
      [
        "Read and write block trees",
        "Run tree queries (children, ancestors)",
        "Batch writes for a single edit",
      ],
      [],
      {
        groupId: "g-infra",
        goal: "Hide the database behind one interface the app controls.",
      },
    ),
    node(
      "search-service",
      "service",
      "SearchService",
      "Indexes block content and answers full-text queries.",
      { x: COL[2], y: row(1) },
      [
        "Index block text as it changes",
        "Answer ranked full-text queries",
        "Filter results by page permissions",
      ],
      [],
      {
        groupId: "g-infra",
        goal: "Make every word in every page findable in milliseconds.",
        openQuestions:
          "Index synchronously on each edit, or async off the change stream?\nHow fresh must search be — seconds or minutes?",
      },
    ),
    node(
      "media-adapter",
      "adapter",
      "MediaAdapter",
      "Stores and serves uploaded images.",
      { x: COL[2], y: row(2) },
      [
        "Issue upload URLs",
        "Serve images through a CDN",
        "Enforce size and type limits",
      ],
      [],
      {
        groupId: "g-infra",
        goal: "Get images in and out fast without coupling to one storage vendor.",
        openQuestions:
          "Direct-to-storage signed uploads, or proxy bytes through the server?",
      },
    ),
  ],
  edges: [
    edge("ws-manager", "page", "owns", "creates & owns pages"),
    edge("ws-manager", "page-service", "uses", "delegates page ops to"),
    edge("page-service", "block-store", "uses", "reads & writes trees via"),
    edge("page-service", "block", "owns", "owns a page's blocks"),
    edge("collab-service", "crdt-worker", "uses", "merges edits through"),
    edge(
      "collab-service",
      "search-service",
      "emits",
      "change events to re-index",
    ),
    edge("crdt-worker", "page", "uses", "applies merged ops to"),
    edge("text-block", "block", "extends", "is a"),
    edge("table-block", "block", "extends", "is a"),
    edge("image-block", "block", "extends", "is a"),
    edge("image-block", "media-adapter", "uses", "stores/loads images via"),
    edge("search-service", "block", "uses", "indexes content from"),
  ],
};

// ============================================================================
// Kanban Board (Trello-lite) — boards, cards, live collaboration, reminders
// ============================================================================
const KANBAN: ArchitectProject = {
  version: 2,
  systemName: "Kanban Board",
  systemGoal:
    "Boards of columns and cards that a team drags around together in real time, with an activity trail and timely reminders.",
  groups: [
    group("g-domain", "Board domain"),
    group("g-collab", "Live collaboration"),
    group("g-engage", "Notifications"),
  ],
  nodes: [
    node(
      "board-manager",
      "manager",
      "BoardManager",
      "Owns a board's structure — its columns and their order.",
      { x: COL[0], y: row(0) },
      [
        "Create and archive boards",
        "Add, rename, and reorder columns",
        "Enforce board membership",
      ],
      [],
      {
        groupId: "g-domain",
        goal: "Be the authority for what a board is made of and who is on it.",
      },
    ),
    node(
      "card-service",
      "service",
      "CardService",
      "Creates, edits, and moves cards between columns.",
      { x: COL[0], y: row(1) },
      [
        "Create and edit cards",
        "Move cards within and across columns",
        "Manage labels, assignees, and due dates",
      ],
      [],
      {
        groupId: "g-domain",
        goal: "Own everything that happens to a card — its content, placement, and metadata.",
        openQuestions:
          "Card ordering — fractional index, linked list, or integer ranks with periodic rebalancing?",
      },
    ),
    node(
      "board",
      "data",
      "Board",
      "A board and its columns.",
      { x: COL[0], y: row(2) },
      [],
      [
        field("board", "id", "ID", "Primary key"),
        field("board", "name", "string", "Board name"),
        field("board", "ownerId", "ID", "Creator"),
        field("board", "columnIds", "ID[]", "Ordered columns"),
        field("board", "memberIds", "ID[]", "Collaborators"),
        field("board", "visibility", "enum", "private | team | public"),
      ],
      {
        groupId: "g-domain",
        goal: "Be the container everything else hangs off.",
      },
    ),
    node(
      "column",
      "data",
      "Column",
      "A single list/column on a board.",
      { x: COL[0], y: row(3) },
      [],
      [
        field("column", "id", "ID", "Primary key"),
        field("column", "boardId", "ID", "Owning board"),
        field("column", "title", "string", "Column title"),
        field("column", "order", "string", "Position among columns"),
      ],
      {
        groupId: "g-domain",
        goal: "Group cards into a stage of the workflow.",
      },
    ),
    node(
      "card",
      "data",
      "Card",
      "A work item that moves across columns.",
      { x: COL[0], y: row(4) },
      [],
      [
        field("card", "id", "ID", "Primary key"),
        field("card", "columnId", "ID", "Current column"),
        field("card", "title", "string", "Card title"),
        field("card", "description", "string", "Markdown body"),
        field("card", "assigneeIds", "ID[]", "Assigned members"),
        field("card", "labelIds", "ID[]", "Applied labels"),
        field("card", "dueAt", "timestamp", "Optional due date"),
        field("card", "order", "string", "Position within its column"),
      ],
      {
        groupId: "g-domain",
        goal: "Be the unit of work people create, move, and complete.",
      },
    ),

    node(
      "sync-worker",
      "worker",
      "RealtimeSyncWorker",
      "Keeps every open board in sync the instant anything changes.",
      { x: COL[1], y: row(0) },
      [
        "Broadcast card and column changes",
        "Apply remote moves locally",
        "Reconcile two people dragging the same card",
      ],
      [],
      {
        groupId: "g-collab",
        goal: "Make the board feel like one shared surface, not many stale copies.",
        openQuestions:
          "Last-write-wins on a contested move, or operational transform to merge both drags?",
      },
    ),
    node(
      "activity-worker",
      "worker",
      "ActivityWorker",
      "Records who did what, so the board has a trustworthy history.",
      { x: COL[1], y: row(1) },
      [
        "Append every action to the log",
        "Derive the per-card activity feed",
      ],
      [],
      {
        groupId: "g-collab",
        goal: "Give the board a reliable answer to 'who moved this, and when?'.",
      },
    ),
    node(
      "ws-gateway",
      "adapter",
      "WebSocketGateway",
      "Carries realtime messages between the server and every open board.",
      { x: COL[1], y: row(2) },
      ["Hold client connections", "Route messages to board rooms"],
      [],
      {
        groupId: "g-collab",
        goal: "Be the transport the rest of the app never has to think about.",
      },
    ),
    node(
      "activity-log",
      "data",
      "ActivityLog",
      "An append-only record of board actions.",
      { x: COL[1], y: row(3) },
      [],
      [
        field("activity-log", "id", "ID", "Primary key"),
        field("activity-log", "boardId", "ID", "Board the action happened on"),
        field("activity-log", "actorId", "ID", "Who did it"),
        field("activity-log", "action", "enum", "card_moved | card_added | …"),
        field("activity-log", "targetId", "ID", "Card or column affected"),
        field("activity-log", "at", "timestamp", "When"),
      ],
      {
        groupId: "g-collab",
        goal: "Be the source of truth for the board's history.",
        dataNotes: "Append-only — never updated in place, only inserted.",
      },
    ),

    node(
      "notification-service",
      "service",
      "NotificationService",
      "Tells the right person at the right time, without spamming them.",
      { x: COL[2], y: row(0) },
      [
        "Notify on assignment and @mention",
        "Send due-soon reminders",
        "Respect each person's notification preferences",
      ],
      [],
      {
        groupId: "g-engage",
        goal: "Keep people informed of what needs them — and quiet otherwise.",
        openQuestions:
          "Batch changes into digests or send immediately?\nHow do we de-duplicate a flurry of edits into one notification?",
      },
    ),
    node(
      "due-worker",
      "worker",
      "DueDateWorker",
      "Catches due and overdue cards before the user does.",
      { x: COL[2], y: row(1) },
      ["Scan for upcoming and overdue cards", "Emit reminder events"],
      [],
      {
        groupId: "g-engage",
        goal: "Make sure a deadline never passes silently.",
      },
    ),
    node(
      "notification-adapter",
      "adapter",
      "NotificationAdapter",
      "Delivers a notification over whatever channel the user chose.",
      { x: COL[2], y: row(2) },
      ["Send email", "Send mobile push"],
      [],
      {
        groupId: "g-engage",
        goal: "Reach the user without the app caring which channel won.",
      },
    ),
  ],
  edges: [
    edge("board-manager", "board", "owns", "creates & owns boards"),
    edge("board-manager", "column", "owns", "owns columns"),
    edge("board-manager", "card-service", "uses", "delegates card ops to"),
    edge("card-service", "card", "owns", "creates & owns cards"),
    edge("card-service", "board", "uses", "places cards within"),
    edge("card-service", "sync-worker", "emits", "card changes for live sync"),
    edge("card-service", "activity-worker", "emits", "actions to record"),
    edge(
      "card-service",
      "notification-service",
      "emits",
      "assignment & mention events",
    ),
    edge("sync-worker", "card", "uses", "broadcasts moves of"),
    edge("sync-worker", "ws-gateway", "emits", "updates to clients via"),
    edge("activity-worker", "activity-log", "owns", "appends entries to"),
    edge("activity-worker", "card", "uses", "records changes to"),
    edge("due-worker", "card", "uses", "scans for due dates on"),
    edge(
      "due-worker",
      "notification-service",
      "emits",
      "due & overdue reminders",
    ),
    edge("notification-service", "notification-adapter", "uses", "sends via"),
  ],
};

// ============================================================================
// Music & Podcast Streaming (Spotify-lite) — catalog, playback, ingest, recs
// ============================================================================
const STREAMING: ArchitectProject = {
  version: 2,
  systemName: "Music & Podcast Streaming",
  systemGoal:
    "Browse a library, stream audio that starts instantly, and get recommendations — fed by an ingestion pipeline that transcodes every upload.",
  groups: [
    group("g-catalog", "Catalog & playback"),
    group("g-content", "Content model"),
    group("g-pipeline", "Ingestion pipeline"),
    group("g-personal", "Personalization"),
  ],
  nodes: [
    node(
      "catalog-service",
      "service",
      "CatalogService",
      "Searches and browses tracks, albums, artists, shows, and episodes.",
      { x: COL[0], y: row(0) },
      [
        "Full-text and faceted search",
        "Browse by artist, album, show, and genre",
        "Serve detail pages",
      ],
      [],
      {
        groupId: "g-catalog",
        goal: "Make the whole library findable and browsable in milliseconds.",
      },
    ),
    node(
      "playback-manager",
      "manager",
      "PlaybackManager",
      "Drives the play queue, current item, and position.",
      { x: COL[0], y: row(1) },
      [
        "Manage the queue and current item",
        "Handle play, pause, skip, and seek",
        "Emit play and completion events",
      ],
      [],
      {
        groupId: "g-catalog",
        goal: "Own the listener's session — what's playing, what's next, and where they are.",
      },
    ),
    node(
      "streaming-service",
      "service",
      "StreamingService",
      "Issues signed, adaptive-bitrate streaming URLs.",
      { x: COL[0], y: row(2) },
      [
        "Issue short-lived signed URLs",
        "Choose the bitrate ladder for the network",
        "Enforce concurrent-stream limits",
      ],
      [],
      {
        groupId: "g-catalog",
        goal: "Deliver audio that starts instantly and adapts to the connection.",
        openQuestions:
          "Signed-URL expiry and DRM policy — how do we stop link sharing and ripping?",
      },
    ),
    node(
      "cdn-adapter",
      "adapter",
      "CDNAdapter",
      "Serves audio segments from the edge, close to every listener.",
      { x: COL[0], y: row(3) },
      ["Cache and deliver audio segments", "Purge stale renditions"],
      [],
      {
        groupId: "g-catalog",
        goal: "Put the bytes physically near the listener.",
      },
    ),
    node(
      "playback-session",
      "data",
      "PlaybackSession",
      "One listener's current session.",
      { x: COL[0], y: row(4) },
      [],
      [
        field("playback-session", "id", "ID", "Primary key"),
        field("playback-session", "userId", "ID", "Listener"),
        field("playback-session", "queue", "MediaId[]", "Upcoming items"),
        field("playback-session", "currentMediaId", "ID", "Now playing"),
        field("playback-session", "positionMs", "number", "Playhead"),
        field("playback-session", "device", "string", "Where it's playing"),
      ],
      {
        groupId: "g-catalog",
        goal: "Let playback resume seamlessly across devices.",
      },
    ),

    node(
      "media-item",
      "base",
      "MediaItem",
      "The abstract playable item that tracks and episodes derive from.",
      { x: COL[1], y: row(0) },
      ["Hold shared metadata", "Reference its audio asset"],
      [
        field("media-item", "id", "ID", "Primary key"),
        field("media-item", "title", "string", "Display title"),
        field("media-item", "durationMs", "number", "Length"),
        field("media-item", "audioAssetId", "ID", "Transcoded audio"),
        field("media-item", "explicit", "boolean", "Content flag"),
      ],
      {
        groupId: "g-content",
        goal: "Define the one shape — title, duration, audio — every playable item shares.",
      },
    ),
    node(
      "track",
      "data",
      "Track",
      "A music track.",
      { x: COL[1], y: row(1) },
      [],
      [
        field("track", "artistId", "ID", "Performer"),
        field("track", "albumId", "ID", "Album it belongs to"),
        field("track", "trackNumber", "integer", "Order on the album"),
        field("track", "isrc", "string", "Recording code"),
      ],
      {
        groupId: "g-content",
        goal: "Represent one song with its album and artist links.",
      },
    ),
    node(
      "episode",
      "data",
      "Episode",
      "A podcast episode.",
      { x: COL[1], y: row(2) },
      [],
      [
        field("episode", "showId", "ID", "Parent show"),
        field("episode", "seasonNumber", "integer", "Season"),
        field("episode", "publishedAt", "timestamp", "Release date"),
        field("episode", "description", "string", "Show notes"),
      ],
      {
        groupId: "g-content",
        goal: "Represent one podcast episode within a show.",
      },
    ),

    node(
      "ingest-service",
      "service",
      "IngestService",
      "Accepts source audio and metadata, then kicks off processing.",
      { x: COL[2], y: row(0) },
      [
        "Accept source uploads",
        "Validate format and metadata",
        "Trigger transcoding and track status",
      ],
      [],
      {
        groupId: "g-pipeline",
        goal: "Take raw uploaded audio and get it ready to stream.",
      },
    ),
    node(
      "transcode-worker",
      "worker",
      "TranscodeWorker",
      "Transcodes source audio into adaptive-bitrate renditions.",
      { x: COL[2], y: row(1) },
      [
        "Transcode to the bitrate ladder (HLS)",
        "Generate per-segment files",
        "Mark the asset ready when done",
      ],
      [],
      {
        groupId: "g-pipeline",
        goal: "Turn one source file into every rendition listeners need.",
        openQuestions:
          "Which codec and bitrate ladder (AAC vs Opus)?\nTranscode everything on ingest, or lazily on first play?",
      },
    ),
    node(
      "audio-asset",
      "data",
      "AudioAsset",
      "The source file and its transcoded renditions.",
      { x: COL[2], y: row(2) },
      [],
      [
        field("audio-asset", "id", "ID", "Primary key"),
        field("audio-asset", "sourceUrl", "string", "Original upload"),
        field("audio-asset", "renditions", "Rendition[]", "Bitrate variants"),
        field("audio-asset", "durationMs", "number", "Length"),
        field("audio-asset", "status", "enum", "uploaded | processing | ready | failed"),
        field("audio-asset", "loudnessLufs", "number", "Normalization target"),
      ],
      {
        groupId: "g-pipeline",
        goal: "Be the single record of an item's audio across all bitrates.",
      },
    ),
    node(
      "storage-adapter",
      "adapter",
      "ObjectStorageAdapter",
      "Stores source and transcoded audio durably and cheaply.",
      { x: COL[2], y: row(3) },
      [
        "Store source and rendition files",
        "Serve byte-range reads to the CDN origin",
      ],
      [],
      {
        groupId: "g-pipeline",
        goal: "Hold the bytes so the rest of the system doesn't have to.",
      },
    ),

    node(
      "recommender-worker",
      "worker",
      "RecommenderWorker",
      "Builds recommendations from listening history.",
      { x: COL[3], y: row(0) },
      [
        "Build per-user taste profiles",
        "Generate 'Made for you' sets",
        "Handle cold-start for brand-new users",
      ],
      [],
      {
        groupId: "g-personal",
        goal: "Surface the next thing a listener will love.",
        openQuestions:
          "Collaborative filtering, content-based, or a hybrid?\nHow do we keep recs fresh without overfitting to the last few plays?",
      },
    ),
    node(
      "history-service",
      "service",
      "PlayHistoryService",
      "Records and queries listening events from playback.",
      { x: COL[3], y: row(1) },
      [
        "Record play and completion events",
        "Answer history and 'recently played' queries",
        "Aggregate plays for reporting and royalties",
      ],
      [],
      {
        groupId: "g-personal",
        goal: "Record what was actually played — accurately enough to pay for it.",
        openQuestions:
          "What counts as a 'play' for royalties (the 30-second threshold)?\nAt this event volume, do we need a stream/queue in front of storage?",
      },
    ),
    node(
      "listening-event",
      "data",
      "ListeningEvent",
      "One record of something being played.",
      { x: COL[3], y: row(2) },
      [],
      [
        field("listening-event", "id", "ID", "Primary key"),
        field("listening-event", "userId", "ID", "Listener"),
        field("listening-event", "mediaId", "ID", "What was played"),
        field("listening-event", "playedMs", "number", "How long"),
        field("listening-event", "completed", "boolean", "Finished?"),
        field("listening-event", "at", "timestamp", "When"),
      ],
      {
        groupId: "g-personal",
        goal: "Be the raw signal behind both recommendations and royalties.",
        dataNotes:
          "Very high volume and append-only — likely lands on a stream before it reaches storage.",
      },
    ),
  ],
  edges: [
    edge("catalog-service", "media-item", "uses", "searches & browses"),
    edge("playback-manager", "playback-session", "owns", "owns the session"),
    edge(
      "playback-manager",
      "streaming-service",
      "uses",
      "requests stream URLs from",
    ),
    edge(
      "playback-manager",
      "history-service",
      "emits",
      "play & completion events",
    ),
    edge("streaming-service", "cdn-adapter", "uses", "serves segments via"),
    edge("streaming-service", "audio-asset", "uses", "reads renditions of"),
    edge("track", "media-item", "extends", "is a"),
    edge("episode", "media-item", "extends", "is a"),
    edge("ingest-service", "audio-asset", "owns", "creates & owns"),
    edge("ingest-service", "transcode-worker", "uses", "queues work to"),
    edge("transcode-worker", "storage-adapter", "uses", "writes renditions to"),
    edge(
      "transcode-worker",
      "catalog-service",
      "emits",
      "'ready' events to publish",
    ),
    edge("recommender-worker", "listening-event", "uses", "learns taste from"),
    edge("history-service", "listening-event", "owns", "records & owns"),
  ],
};

export const ARCHITECT_TEMPLATES: readonly ArchitectTemplate[] = [
  { id: "notion", label: "Doc Workspace", project: NOTION },
  { id: "kanban", label: "Kanban Board", project: KANBAN },
  { id: "streaming", label: "Streaming", project: STREAMING },
];
