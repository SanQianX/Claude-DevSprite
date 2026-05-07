/**
 * ChatInput Component Tests
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatInput from '../../src/components/chat/ChatInput.vue';

describe('ChatInput', () => {
  it('should render textarea and button', () => {
    const wrapper = mount(ChatInput);

    expect(wrapper.find('textarea').exists()).toBe(true);
    expect(wrapper.find('.send-btn').exists()).toBe(true);
  });

  it('should have correct placeholder', () => {
    const wrapper = mount(ChatInput);

    expect(wrapper.find('textarea').attributes('placeholder')).toContain('输入');
  });

  it('should show "发送中..." when disabled', () => {
    const wrapper = mount(ChatInput, { props: { disabled: true } });

    expect(wrapper.find('.send-btn').text()).toBe('发送中...');
  });

  it('should show "发送" when not disabled', () => {
    const wrapper = mount(ChatInput, { props: { disabled: false } });

    expect(wrapper.find('.send-btn').text()).toBe('发送');
  });

  it('should disable textarea when disabled prop is true', () => {
    const wrapper = mount(ChatInput, { props: { disabled: true } });

    expect(wrapper.find('textarea').element.disabled).toBe(true);
  });

  it('should enable textarea when disabled prop is false', () => {
    const wrapper = mount(ChatInput, { props: { disabled: false } });

    expect(wrapper.find('textarea').element.disabled).toBe(false);
  });

  it('should have 3 rows textarea', () => {
    const wrapper = mount(ChatInput);

    expect(wrapper.find('textarea').attributes('rows')).toBe('3');
  });

  it('should render with correct structure', () => {
    const wrapper = mount(ChatInput);

    expect(wrapper.find('.chat-input-container').exists()).toBe(true);
    expect(wrapper.find('.chat-input-container').find('textarea').exists()).toBe(true);
    expect(wrapper.find('.chat-input-container').find('.send-btn').exists()).toBe(true);
  });
});
