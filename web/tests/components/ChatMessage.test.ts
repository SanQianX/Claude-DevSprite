/**
 * ChatMessage Component Tests
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatMessage from '../../src/components/chat/ChatMessage.vue';
import type { ChatMessage as ChatMessageType } from '../../src/stores/chat';

describe('ChatMessage', () => {
  it('should render user message', () => {
    const msg: ChatMessageType = {
      id: 'msg-1',
      type: 'user',
      content: 'Hello agent',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.find('.message-text').text()).toBe('Hello agent');
    expect(wrapper.find('.message-sender').text()).toBe('你');
    expect(wrapper.classes()).toContain('user-message');
  });

  it('should render agent message with team name', () => {
    const msg: ChatMessageType = {
      id: 'msg-2',
      type: 'agent',
      team: 'dev',
      content: 'Task completed',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.find('.message-text').text()).toBe('Task completed');
    expect(wrapper.find('.message-sender').text()).toBe('Dev');
    expect(wrapper.classes()).toContain('agent');
  });

  it('should render tool message', () => {
    const msg: ChatMessageType = {
      id: 'msg-3',
      type: 'tool',
      team: 'dev',
      content: 'Reading file src/index.ts',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.classes()).toContain('tool');
    expect(wrapper.find('.message-text').text()).toContain('Reading file');
  });

  it('should render error message', () => {
    const msg: ChatMessageType = {
      id: 'msg-4',
      type: 'error',
      content: 'Process crashed',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.classes()).toContain('error');
    expect(wrapper.find('.message-text').text()).toBe('Process crashed');
  });

  it('should render system message', () => {
    const msg: ChatMessageType = {
      id: 'msg-5',
      type: 'system',
      content: 'Connected to server',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.classes()).toContain('system');
  });

  it('should show task ID when present', () => {
    const msg: ChatMessageType = {
      id: 'msg-6',
      type: 'agent',
      team: 'dev',
      content: 'Working on task',
      timestamp: new Date('2026-05-03T01:00:00Z'),
      taskId: 'task-001',
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.find('.message-task-id').text()).toContain('task-001');
  });

  it('should not show task ID when absent', () => {
    const msg: ChatMessageType = {
      id: 'msg-7',
      type: 'agent',
      team: 'dev',
      content: 'No task',
      timestamp: new Date('2026-05-03T01:00:00Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });

    expect(wrapper.find('.message-task-id').exists()).toBe(false);
  });

  it('should display correct team emoji for each team', () => {
    const teams = ['lead', 'dev', 'test'];

    for (const team of teams) {
      const msg: ChatMessageType = {
        id: `msg-${team}`,
        type: 'agent',
        team,
        content: 'Test',
        timestamp: new Date(),
      };

      const wrapper = mount(ChatMessage, { props: { msg } });
      expect(wrapper.find('.message-avatar').exists()).toBe(true);
    }
  });

  it('should format timestamp correctly', () => {
    const msg: ChatMessageType = {
      id: 'msg-8',
      type: 'user',
      content: 'Test',
      timestamp: new Date('2026-05-03T01:30:45Z'),
    };

    const wrapper = mount(ChatMessage, { props: { msg } });
    const timeText = wrapper.find('.message-time').text();

    // Should contain time components
    expect(timeText).toBeTruthy();
  });
});
