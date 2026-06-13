import type {
  PromptGroupListResponse,
  TConversation,
  TConversationTag,
  TConversationTagRequest,
  TCreatePrompt,
  TCreatePromptResponse,
  TDeletePromptResponse,
  TPrompt,
  TPromptGroup,
  TPromptGroupsWithFilterRequest,
  TUpdatePromptGroupPayload,
  TSkill,
  TSkillSummary,
  TSkillListRequest,
  TSkillListResponse,
  TCreateSkill,
  TUpdateSkillPayload,
  TSkillStatesResponse,
} from 'librechat-data-provider';
import {
  listPremadePrompts,
  getPremadePrompt,
  createPremadePrompt,
  updatePremadePrompt,
  deletePremadePrompt,
  getCurrentPremadePromptLocale,
  getPremadePromptDisplay,
} from './premadePrompts';
import type { PremadePrompt } from './premadePrompts';

const TAGS_KEY = 'maya:workspace:conversation-tags';
const CONVO_TAGS_KEY = 'maya:workspace:conversation-tag-map';
const PROMPTS_KEY = 'maya:workspace:prompt-groups';
const SKILLS_KEY = 'maya:workspace:skills';
const SKILL_STATES_KEY = 'maya:workspace:skill-states';
const SKILL_FAVORITES_KEY = 'maya:workspace:skill-favorites';
const BACKEND_PROMPT_MAP_KEY = 'maya:workspace:backend-prompt-map';
const BACKEND_PROMPT_GROUP_MAP_KEY = 'maya:workspace:backend-prompt-group-map';
const BACKEND_SKILL_PREFIX = 'backend_';
const USER_ID = 'guest';
const USER_NAME = 'Guest';

type StoredPromptGroup = Omit<TPromptGroup, 'createdAt' | 'updatedAt'> & {
  createdAt?: string;
  updatedAt?: string;
  prompts: TPrompt[];
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

function slugifySkillName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'imported-skill'
  );
}

function unquoteFrontmatterValue(value: string): string {
  const withoutComment = value.replace(/\s+#.*$/, '').trim();
  if (
    (withoutComment.startsWith('"') && withoutComment.endsWith('"')) ||
    (withoutComment.startsWith("'") && withoutComment.endsWith("'"))
  ) {
    return withoutComment.slice(1, -1);
  }
  return withoutComment;
}

type ParsedSkillFrontmatter = {
  name?: string;
  displayTitle?: string;
  description?: string;
  alwaysApply?: boolean;
  category?: string;
};

function parseSkillFrontmatter(raw: string): ParsedSkillFrontmatter {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('---')) {
    return {};
  }

  const after = trimmed.slice(3);
  const closingIdx = after.indexOf('\n---');
  if (closingIdx === -1) {
    return {};
  }

  const parsed: ParsedSkillFrontmatter = {};
  for (const line of after.slice(0, closingIdx).split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = unquoteFrontmatterValue(line.slice(colon + 1));
    if (!value) {
      continue;
    }
    if (key === 'name') {
      parsed.name = value;
    } else if (key === 'display-title' || key === 'displaytitle' || key === 'title') {
      parsed.displayTitle = value;
    } else if (key === 'description') {
      parsed.description = value;
    } else if (key === 'category') {
      parsed.category = value;
    } else if (key === 'always-apply') {
      parsed.alwaysApply = value.toLowerCase() === 'true';
    }
  }
  return parsed;
}

function inferSkillDescription(body: string, fallback: string): string {
  const frontmatter = parseSkillFrontmatter(body);
  if (frontmatter.description) {
    return frontmatter.description;
  }
  const firstContentLine = body
    .replace(/^---[\s\S]*?\n---/, '')
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find(Boolean);
  return firstContentLine?.slice(0, 1024) || fallback;
}

function buildSkillPayloadFromText(filename: string, content: string): TCreateSkill {
  const frontmatter = parseSkillFrontmatter(content);
  const nameFromFile = filename.replace(/\.(md|skill)$/i, '');
  const name = slugifySkillName(frontmatter.name || nameFromFile);
  return {
    name,
    displayTitle: frontmatter.displayTitle,
    description: inferSkillDescription(content, frontmatter.description || name),
    body: content,
    frontmatter,
    category: frontmatter.category,
    alwaysApply: frontmatter.alwaysApply,
  };
}

function readBlobText(blob: Blob): Promise<string> {
  if ('text' in blob && typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read skill file'));
    reader.readAsText(blob);
  });
}

function getTagRecords(): TConversationTag[] {
  return readJson<TConversationTag[]>(TAGS_KEY, []);
}

function saveTagRecords(tags: TConversationTag[]) {
  writeJson(TAGS_KEY, tags);
}

function getConversationTagMap(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(CONVO_TAGS_KEY, {});
}

function saveConversationTagMap(map: Record<string, string[]>) {
  writeJson(CONVO_TAGS_KEY, map);
}

function countTagUsage(tag: string, map = getConversationTagMap()) {
  return Object.values(map).filter((tags) => tags.includes(tag)).length;
}

function withCounts(tags: TConversationTag[]) {
  const map = getConversationTagMap();
  return tags
    .map((tag, index) => ({
      ...tag,
      position: Number.isFinite(tag.position) ? tag.position : index,
      count: countTagUsage(tag.tag, map),
    }))
    .sort((a, b) => a.position - b.position);
}

export function listWorkspaceBookmarks(): TConversationTag[] {
  return withCounts(getTagRecords());
}

export function createWorkspaceBookmark(payload: TConversationTagRequest): TConversationTag {
  const tagName = (payload.tag ?? '').trim();
  if (!tagName) {
    throw new Error('Bookmark title is required');
  }

  const tags = getTagRecords();
  const existing = tags.find((tag) => tag.tag === tagName);
  const timestamp = nowIso();

  if (existing) {
    const updated = {
      ...existing,
      description: payload.description ?? existing.description ?? '',
      updatedAt: timestamp,
    };
    saveTagRecords(tags.map((tag) => (tag._id === existing._id ? updated : tag)));
    if (payload.addToConversation && payload.conversationId) {
      setConversationBookmarks(payload.conversationId, [
        ...new Set([...getConversationBookmarks(payload.conversationId), updated.tag]),
      ]);
    }
    return { ...updated, count: countTagUsage(updated.tag) };
  }

  const record: TConversationTag = {
    _id: createId('bookmark'),
    user: USER_ID,
    tag: tagName,
    description: payload.description ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    count: 0,
    position: tags.length,
  };

  saveTagRecords([...tags, record]);
  if (payload.addToConversation && payload.conversationId) {
    setConversationBookmarks(payload.conversationId, [
      ...new Set([...getConversationBookmarks(payload.conversationId), record.tag]),
    ]);
  }
  return { ...record, count: countTagUsage(record.tag) };
}

export function updateWorkspaceBookmark(
  tagName: string,
  payload: TConversationTagRequest,
): TConversationTag {
  const tags = getTagRecords();
  const existing = tags.find((tag) => tag.tag === tagName);
  if (!existing) {
    return createWorkspaceBookmark(payload);
  }

  const nextTag = (payload.tag ?? existing.tag).trim();
  const updated: TConversationTag = {
    ...existing,
    tag: nextTag,
    description: payload.description ?? existing.description ?? '',
    updatedAt: nowIso(),
  };
  saveTagRecords(tags.map((tag) => (tag._id === existing._id ? updated : tag)));

  if (nextTag !== existing.tag) {
    const map = getConversationTagMap();
    for (const [conversationId, conversationTags] of Object.entries(map)) {
      map[conversationId] = conversationTags.map((tag) => (tag === existing.tag ? nextTag : tag));
    }
    saveConversationTagMap(map);
  }

  return { ...updated, count: countTagUsage(updated.tag) };
}

export function deleteWorkspaceBookmark(tagName: string): TConversationTag {
  const tags = getTagRecords();
  const deleted =
    tags.find((tag) => tag.tag === tagName) ??
    ({
      _id: createId('bookmark'),
      user: USER_ID,
      tag: tagName,
      description: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      count: 0,
      position: tags.length,
    } satisfies TConversationTag);

  saveTagRecords(
    tags
      .filter((tag) => tag.tag !== tagName)
      .map((tag, index) => ({
        ...tag,
        position: index,
      })),
  );

  const map = getConversationTagMap();
  for (const [conversationId, conversationTags] of Object.entries(map)) {
    map[conversationId] = conversationTags.filter((tag) => tag !== tagName);
  }
  saveConversationTagMap(map);
  return { ...deleted, count: 0 };
}

export function getConversationBookmarks(conversationId: string): string[] {
  return getConversationTagMap()[conversationId] ?? [];
}

export function setConversationBookmarks(conversationId: string, tags: string[]): string[] {
  const validTags = new Set(getTagRecords().map((tag) => tag.tag));
  const nextTags = [...new Set(tags)].filter((tag) => validTags.has(tag));
  const map = getConversationTagMap();
  map[conversationId] = nextTags;
  saveConversationTagMap(map);
  return nextTags;
}

export function attachWorkspaceBookmarks<T extends Partial<TConversation>>(conversation: T): T {
  const conversationId = conversation.conversationId;
  if (!conversationId) {
    return conversation;
  }
  return {
    ...conversation,
    tags: getConversationBookmarks(conversationId),
  };
}

function getPromptRecords(): StoredPromptGroup[] {
  return readJson<StoredPromptGroup[]>(PROMPTS_KEY, []);
}

function savePromptRecords(groups: StoredPromptGroup[]) {
  writeJson(PROMPTS_KEY, groups);
}

function toPromptGroup(group: StoredPromptGroup): TPromptGroup {
  const productionPrompt =
    group.prompts.find((prompt) => prompt._id === group.productionId) ?? group.prompts[0] ?? null;

  return {
    _id: group._id,
    name: group.name,
    numberOfGenerations: group.numberOfGenerations ?? 0,
    command: group.command,
    oneliner: group.oneliner,
    category: group.category,
    productionId: productionPrompt?._id ?? null,
    productionPrompt: productionPrompt ? { prompt: productionPrompt.prompt } : null,
    author: group.author,
    authorName: group.authorName,
    isPublic: group.isPublic ?? false,
    createdAt: group.createdAt ? new Date(group.createdAt) : undefined,
    updatedAt: group.updatedAt ? new Date(group.updatedAt) : undefined,
  };
}

function filterPromptGroups(
  groups: StoredPromptGroup[],
  filter: Partial<TPromptGroupsWithFilterRequest> = {},
) {
  const name = filter.name?.trim().toLowerCase();
  const category = filter.category?.trim().toLowerCase();
  return groups.filter((group) => {
    const nameMatch =
      !name ||
      group.name.toLowerCase().includes(name) ||
      (group.command ?? '').toLowerCase().includes(name) ||
      (group.oneliner ?? '').toLowerCase().includes(name);
    const categoryMatch = !category || (group.category ?? '').toLowerCase() === category;
    return nameMatch && categoryMatch;
  });
}

export function listWorkspacePromptGroups(
  filter: Partial<TPromptGroupsWithFilterRequest> = {},
): PromptGroupListResponse {
  const limit = Number(filter.limit ?? filter.pageSize ?? 10);
  const cursor = filter.cursor ?? filter.after ?? '';
  const groups = filterPromptGroups(getPromptRecords(), filter);
  const start = cursor ? Math.max(groups.findIndex((group) => group._id === cursor) + 1, 0) : 0;
  const page = groups.slice(start, start + limit);
  const last = page[page.length - 1];
  const hasMore = start + limit < groups.length;

  return {
    promptGroups: page.map(toPromptGroup),
    pageNumber: '1',
    pageSize: limit,
    pages: Math.max(1, Math.ceil(groups.length / Math.max(limit, 1))),
    has_more: hasMore,
    after: hasMore ? (last?._id ?? null) : null,
  };
}

export function listAllWorkspacePromptGroups(): TPromptGroup[] {
  return getPromptRecords().map(toPromptGroup);
}

export function getWorkspacePromptGroup(groupId: string): TPromptGroup | null {
  const group = getPromptRecords().find((record) => record._id === groupId);
  return group ? toPromptGroup(group) : null;
}

export function listWorkspacePrompts(groupId: string): TPrompt[] {
  return getPromptRecords().find((group) => group._id === groupId)?.prompts ?? [];
}

export function createWorkspacePrompt(payload: TCreatePrompt): TCreatePromptResponse {
  const records = getPromptRecords();
  const timestamp = nowIso();
  const groupId = payload.prompt.groupId ?? createId('prompt_group');
  let group = records.find((record) => record._id === groupId);
  const isNewGroup = !group;

  if (!group) {
    group = {
      _id: groupId,
      name: payload.group?.name?.trim() || 'Untitled prompt',
      command: payload.group?.command?.trim() || undefined,
      category: payload.group?.category?.trim() || undefined,
      oneliner: payload.group?.oneliner?.trim() || undefined,
      author: USER_ID,
      authorName: USER_NAME,
      createdAt: timestamp,
      updatedAt: timestamp,
      numberOfGenerations: 0,
      isPublic: false,
      prompts: [],
    };
    records.push(group);
  }

  const prompt: TPrompt = {
    _id: createId('prompt'),
    groupId,
    author: USER_ID,
    prompt: payload.prompt.prompt,
    type: payload.prompt.type ?? 'text',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  group.prompts = [prompt, ...group.prompts];
  group.productionId = group.productionId ?? prompt._id;
  group.productionPrompt = group.productionPrompt ?? { prompt: prompt.prompt };
  group.updatedAt = timestamp;
  savePromptRecords(records);

  syncPromptGroupToBackend(group).catch(() => {});

  return {
    prompt,
    group: toPromptGroup(group),
  };
}

export function updateWorkspacePromptGroup(
  groupId: string,
  payload: TUpdatePromptGroupPayload,
): TPromptGroup | null {
  const records = getPromptRecords();
  const group = records.find((record) => record._id === groupId);
  if (!group) {
    return null;
  }

  group.name = payload.name ?? group.name;
  group.command = payload.command === null ? undefined : (payload.command ?? group.command);
  group.category = payload.category === null ? undefined : (payload.category ?? group.category);
  group.oneliner = payload.oneliner === null ? undefined : (payload.oneliner ?? group.oneliner);
  group.isPublic = payload.isPublic ?? group.isPublic;
  group.updatedAt = nowIso();
  savePromptRecords(records);

  syncPromptGroupToBackend(group).catch(() => {});

  return toPromptGroup(group);
}

export function deleteWorkspacePromptGroup(groupId: string): { message: string } {
  savePromptRecords(getPromptRecords().filter((group) => group._id !== groupId));
  deletePromptGroupFromBackend(groupId).catch(() => {});
  return { message: 'Prompt group deleted' };
}

export function deleteWorkspacePrompt(promptId: string, groupId: string): TDeletePromptResponse {
  const records = getPromptRecords();
  const group = records.find((record) => record._id === groupId);
  if (!group) {
    return { prompt: promptId, promptGroup: { id: groupId, message: 'Prompt group deleted' } };
  }

  group.prompts = group.prompts.filter((prompt) => prompt._id !== promptId);
  if (group.prompts.length === 0) {
    savePromptRecords(records.filter((record) => record._id !== groupId));
    deletePromptGroupFromBackend(groupId).catch(() => {});
    return { prompt: promptId, promptGroup: { id: groupId, message: 'Prompt group deleted' } };
  }

  if (group.productionId === promptId) {
    group.productionId = group.prompts[0]._id;
    group.productionPrompt = { prompt: group.prompts[0].prompt };
  }
  group.updatedAt = nowIso();
  savePromptRecords(records);
  syncPromptGroupToBackend(group).catch(() => {});
  return { prompt: promptId };
}

export function makeWorkspacePromptProduction(promptId: string): { message: string } {
  const records = getPromptRecords();
  const group = records.find((record) => record.prompts.some((prompt) => prompt._id === promptId));
  const prompt = group?.prompts.find((item) => item._id === promptId);
  if (group && prompt) {
    group.productionId = promptId;
    group.productionPrompt = { prompt: prompt.prompt };
    group.updatedAt = nowIso();
    savePromptRecords(records);
  }
  return { message: 'Production prompt updated' };
}

export function recordWorkspacePromptUsage(groupId: string): { numberOfGenerations: number } {
  const records = getPromptRecords();
  const group = records.find((record) => record._id === groupId);
  if (!group) {
    return { numberOfGenerations: 0 };
  }
  group.numberOfGenerations = (group.numberOfGenerations ?? 0) + 1;
  group.updatedAt = nowIso();
  savePromptRecords(records);
  return { numberOfGenerations: group.numberOfGenerations };
}

export function listWorkspacePromptCategories(): string[] {
  return [
    ...new Set(
      getPromptRecords()
        .map((group) => group.category)
        .filter(Boolean),
    ),
  ] as string[];
}

function getSkillRecords(): TSkill[] {
  return readJson<TSkill[]>(SKILLS_KEY, []);
}

function saveSkillRecords(skills: TSkill[]): void {
  writeJson(SKILLS_KEY, skills);
}

function getBackendPromptMap(): Record<string, string> {
  return readJson<Record<string, string>>(BACKEND_PROMPT_MAP_KEY, {});
}

function setBackendPromptId(localId: string, backendId: string): void {
  const map = getBackendPromptMap();
  map[localId] = backendId;
  writeJson(BACKEND_PROMPT_MAP_KEY, map);
}

function removeBackendPromptId(localId: string): void {
  const map = getBackendPromptMap();
  delete map[localId];
  writeJson(BACKEND_PROMPT_MAP_KEY, map);
}

function getBackendPromptGroupMap(): Record<string, string> {
  return readJson<Record<string, string>>(BACKEND_PROMPT_GROUP_MAP_KEY, {});
}

function setBackendPromptGroupId(groupId: string, backendId: string): void {
  const map = getBackendPromptGroupMap();
  map[groupId] = backendId;
  writeJson(BACKEND_PROMPT_GROUP_MAP_KEY, map);
}

function removeBackendPromptGroupId(groupId: string): void {
  const map = getBackendPromptGroupMap();
  delete map[groupId];
  writeJson(BACKEND_PROMPT_GROUP_MAP_KEY, map);
}

function promptGroupToPremadePrompt(group: StoredPromptGroup): Partial<PremadePrompt> {
  return {
    name: group.name,
    description: group.oneliner || '',
    body: group.productionPrompt?.prompt || group.prompts[0]?.prompt || '',
    category: group.category || '',
    output_format: 'Prompt',
  };
}

async function syncPromptGroupToBackend(group: StoredPromptGroup): Promise<void> {
  const existingBackendId = getBackendPromptGroupMap()[group._id];
  if (existingBackendId) {
    await updatePremadePrompt(existingBackendId, promptGroupToPremadePrompt(group));
  } else {
    const backendPrompt = await createPremadePrompt(promptGroupToPremadePrompt(group));
    setBackendPromptGroupId(group._id, backendPrompt.id);
  }
}

async function deletePromptGroupFromBackend(groupId: string): Promise<void> {
  const backendId = getBackendPromptGroupMap()[groupId];
  if (backendId) {
    await deletePremadePrompt(backendId);
    removeBackendPromptGroupId(groupId);
  }
}

function backendSkillId(promptId: string): string {
  return `${BACKEND_SKILL_PREFIX}${promptId}`;
}

function backendPromptIdFromSkillId(skillId: string): string | null {
  return skillId.startsWith(BACKEND_SKILL_PREFIX)
    ? skillId.slice(BACKEND_SKILL_PREFIX.length)
    : null;
}

function premadePromptToSkill(prompt: PremadePrompt): TSkill {
  const now = nowIso();
  const display = getPremadePromptDisplay(prompt, getCurrentPremadePromptLocale());
  return {
    _id: backendSkillId(prompt.id),
    name: display.name,
    displayTitle: display.name,
    description: display.description || display.name,
    body: prompt.body ?? '',
    category: display.category || prompt.category,
    frontmatter: {
      'user-invocable': true,
      'disable-model-invocation': false,
    },
    userInvocable: true,
    disableModelInvocation: false,
    author: 'system',
    authorName: 'System',
    version: 1,
    source: 'global' as TSkill['source'],
    fileCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function premadePromptToSkillSummary(prompt: PremadePrompt): TSkillSummary {
  return toSkillSummary(premadePromptToSkill(prompt));
}

function skillToPremadePrompt(skill: TSkill): Partial<PremadePrompt> {
  const locale = getCurrentPremadePromptLocale().split('-')[0]?.toLowerCase() || 'en';
  return {
    name: skill.name,
    description: skill.description,
    body: skill.body,
    category: skill.category,
    output_format: 'Skill',
    [`name_${locale}`]: skill.displayTitle ?? skill.name,
    [`description_${locale}`]: skill.description,
    [`category_${locale}`]: skill.category,
    [`output_format_${locale}`]: 'Skill',
  };
}

function skillPayloadToPremadePrompt(payload: TUpdateSkillPayload): Partial<PremadePrompt> {
  const locale = getCurrentPremadePromptLocale().split('-')[0]?.toLowerCase() || 'en';
  return {
    ...(payload.name
      ? { name: payload.name, [`name_${locale}`]: payload.displayTitle ?? payload.name }
      : {}),
    ...(payload.description
      ? { description: payload.description, [`description_${locale}`]: payload.description }
      : {}),
    ...(payload.body ? { body: payload.body } : {}),
    ...(payload.category
      ? { category: payload.category, [`category_${locale}`]: payload.category }
      : {}),
  };
}

function toSkillSummary(skill: TSkill): TSkillSummary {
  const { body: _body, frontmatter: _fm, ...summary } = skill;
  return summary;
}

export function listWorkspaceSkills(params?: TSkillListRequest): TSkillListResponse {
  let skills = getSkillRecords();
  const limit = params?.limit ?? 50;
  const cursor = params?.cursor ?? '';

  if (params?.search) {
    const q = params.search.toLowerCase();
    skills = skills.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }
  if (params?.category) {
    skills = skills.filter((s) => s.category === params.category);
  }

  const start = cursor ? Math.max(skills.findIndex((s) => s._id === cursor) + 1, 0) : 0;
  const page = skills.slice(start, start + limit);
  const hasMore = start + limit < skills.length;
  const last = page[page.length - 1];

  return {
    skills: page.map(toSkillSummary),
    has_more: hasMore,
    after: hasMore ? (last?._id ?? null) : null,
  };
}

export async function listWorkspaceSkillsWithBackend(
  params?: TSkillListRequest,
): Promise<TSkillListResponse> {
  const localResult = listWorkspaceSkills(params);
  try {
    const backendPrompts = await listPremadePrompts(params?.category);
    const mirroredBackendIds = new Set(Object.values(getBackendPromptMap()).map(backendSkillId));
    const search = params?.search?.toLowerCase();
    const backendSkills = backendPrompts
      .map(premadePromptToSkillSummary)
      .filter((s) => !mirroredBackendIds.has(s._id))
      .filter(
        (s) =>
          !search ||
          s.name.toLowerCase().includes(search) ||
          s.description.toLowerCase().includes(search),
      );
    return {
      ...localResult,
      skills: [...backendSkills, ...localResult.skills],
    };
  } catch {
    return localResult;
  }
}

export function getWorkspaceSkill(id: string): TSkill | null {
  return getSkillRecords().find((s) => s._id === id) ?? null;
}

export async function getWorkspaceSkillWithBackend(id: string): Promise<TSkill | null> {
  const backendPromptId = backendPromptIdFromSkillId(id);
  if (backendPromptId) {
    const prompt = await getPremadePrompt(backendPromptId);
    return prompt ? premadePromptToSkill(prompt) : null;
  }
  return getWorkspaceSkill(id);
}

export function getWorkspaceSkillsByNames(names: string[]): TSkill[] {
  const requested = new Set(names);
  return getSkillRecords().filter((skill) => requested.has(skill.name));
}

function createWorkspaceSkillRecord(payload: TCreateSkill): TSkill {
  const records = getSkillRecords();
  const timestamp = nowIso();
  const skill: TSkill = {
    _id: createId('skill'),
    name: payload.name,
    displayTitle: payload.displayTitle,
    description: payload.description,
    body: payload.body,
    frontmatter: payload.frontmatter as TSkill['frontmatter'],
    category: payload.category,
    alwaysApply: payload.alwaysApply,
    author: USER_ID,
    authorName: USER_NAME,
    version: 1,
    source: 'user' as TSkill['source'],
    fileCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  saveSkillRecords([...records, skill]);
  return skill;
}

async function saveWorkspaceSkillToBackend(skill: TSkill): Promise<void> {
  const backendPrompt = await createPremadePrompt(skillToPremadePrompt(skill));
  setBackendPromptId(skill._id, backendPrompt.id);
}

export function createWorkspaceSkill(payload: TCreateSkill): TSkill {
  const skill = createWorkspaceSkillRecord(payload);
  saveWorkspaceSkillToBackend(skill).catch(() => {});
  return skill;
}

export async function createWorkspaceSkillWithBackend(payload: TCreateSkill): Promise<TSkill> {
  const skill = createWorkspaceSkillRecord(payload);
  await saveWorkspaceSkillToBackend(skill);
  return skill;
}

export async function importWorkspaceSkill(formData: FormData): Promise<TSkill> {
  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    throw new Error('Skill import requires a file');
  }

  const filename = 'name' in file && typeof file.name === 'string' ? file.name : 'imported.skill';
  if (/\.zip$/i.test(filename)) {
    throw new Error('Guest workspace skill import supports .md and text .skill files.');
  }

  const content = await readBlobText(file);
  if (!content.trim()) {
    throw new Error('Skill file is empty');
  }

  if (/\.skill$/i.test(filename)) {
    try {
      const parsed = JSON.parse(content) as Partial<TCreateSkill>;
      if (parsed.name && parsed.description && parsed.body) {
        return createWorkspaceSkillWithBackend({
          name: slugifySkillName(parsed.name),
          displayTitle: parsed.displayTitle,
          description: parsed.description,
          body: parsed.body,
          frontmatter: parsed.frontmatter,
          category: parsed.category,
          alwaysApply: parsed.alwaysApply,
        });
      }
    } catch {
      // Text .skill files can also be SKILL.md-compatible markdown.
    }
  }

  return createWorkspaceSkillWithBackend(buildSkillPayloadFromText(filename, content));
}

export function updateWorkspaceSkill(id: string, payload: TUpdateSkillPayload): TSkill | null {
  const records = getSkillRecords();
  const index = records.findIndex((s) => s._id === id);
  if (index === -1) {
    return null;
  }
  const updated: TSkill = {
    ...records[index],
    ...payload,
    version: records[index].version + 1,
    updatedAt: nowIso(),
  };
  records[index] = updated;
  saveSkillRecords(records);
  return updated;
}

export async function updateWorkspaceSkillWithBackend(
  id: string,
  payload: TUpdateSkillPayload,
): Promise<TSkill | null> {
  const backendPromptId = backendPromptIdFromSkillId(id);
  if (backendPromptId) {
    const updatedPrompt = await updatePremadePrompt(
      backendPromptId,
      skillPayloadToPremadePrompt(payload),
    );
    return premadePromptToSkill(updatedPrompt);
  }

  const updated = updateWorkspaceSkill(id, payload);
  const backendId = getBackendPromptMap()[id];
  if (updated && backendId) {
    await updatePremadePrompt(backendId, skillToPremadePrompt(updated));
  }
  return updated;
}

export function deleteWorkspaceSkill(id: string): { acknowledged: boolean } {
  const records = getSkillRecords();
  saveSkillRecords(records.filter((s) => s._id !== id));
  const backendMap = getBackendPromptMap();
  const backendId = backendMap[id];
  if (backendId) {
    deletePremadePrompt(backendId).catch(() => {});
    removeBackendPromptId(id);
  }
  return { acknowledged: true };
}

export async function deleteWorkspaceSkillWithBackend(
  id: string,
): Promise<{ acknowledged: boolean }> {
  const backendPromptId = backendPromptIdFromSkillId(id);
  if (backendPromptId) {
    const acknowledged = await deletePremadePrompt(backendPromptId);
    return { acknowledged };
  }

  const records = getSkillRecords();
  saveSkillRecords(records.filter((s) => s._id !== id));
  const backendMap = getBackendPromptMap();
  const backendId = backendMap[id];
  if (backendId) {
    const acknowledged = await deletePremadePrompt(backendId);
    removeBackendPromptId(id);
    return { acknowledged };
  }
  return { acknowledged: true };
}

export function getWorkspaceSkillStates(): TSkillStatesResponse {
  return readJson<TSkillStatesResponse>(SKILL_STATES_KEY, {});
}

export function updateWorkspaceSkillStates(states: TSkillStatesResponse): TSkillStatesResponse {
  const current = getWorkspaceSkillStates();
  const merged = { ...current, ...states };
  writeJson(SKILL_STATES_KEY, merged);
  return merged;
}

export function getWorkspaceSkillFavorites(): string[] {
  return readJson<string[]>(SKILL_FAVORITES_KEY, []);
}

export function updateWorkspaceSkillFavorites(favorites: string[]): string[] {
  writeJson(SKILL_FAVORITES_KEY, favorites);
  return favorites;
}
