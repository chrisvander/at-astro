import { nextActiveIndex, searchHandleSuggestions, type HandleSuggestion } from "./handle-typeahead"

const elementName = "at-astro-handle-field"
const searchDelay = 200

let fieldCount = 0

type FieldState = "idle" | "loading" | "success" | "empty" | "error"
type BoundElements = {
  input: HTMLInputElement
  listbox: HTMLUListElement
  template: HTMLTemplateElement
}

function requireElements(field: HTMLElement): BoundElements {
  const inputs = field.querySelectorAll<HTMLInputElement>("[data-at-handle-input]")
  const listboxes = field.querySelectorAll<HTMLUListElement>("[data-at-handle-options]")

  if (inputs.length !== 1) {
    throw new Error("HandleField requires exactly one HandleInput")
  }
  if (listboxes.length !== 1) {
    throw new Error("HandleField requires exactly one HandleOptions")
  }

  const input = inputs[0]
  const listbox = listboxes[0]
  const template = listbox.querySelector<HTMLTemplateElement>(
    ":scope > template[data-at-handle-template]",
  )
  const templateRoot = template?.content.firstElementChild

  if (!input || !listbox || !template) {
    throw new Error("HandleField could not initialize its input and options")
  }
  if (template.content.childElementCount !== 1 || !(templateRoot instanceof HTMLLIElement)) {
    throw new Error("HandleOptions requires exactly one li template")
  }

  return { input, listbox, template }
}

function optionFromEvent(event: Event, listbox: HTMLUListElement): HTMLLIElement | null {
  if (!(event.target instanceof Element)) return null
  const option = event.target.closest<HTMLLIElement>("li[data-at-handle-option]")
  return option && listbox.contains(option) ? option : null
}

class HandleFieldElement extends HTMLElement {
  readonly #onInput = () => this.#scheduleSearch()
  readonly #onKeyDown = (event: KeyboardEvent) => this.#handleKeyDown(event)
  readonly #onBlur = () => this.#handleBlur()
  readonly #onMouseDown = (event: MouseEvent) => {
    if (optionFromEvent(event, this.#elements.listbox)) event.preventDefault()
  }
  readonly #onClick = (event: MouseEvent) => {
    const option = optionFromEvent(event, this.#elements.listbox)
    if (!option) return
    this.#select(Number(option.dataset.index))
  }

  #abortController?: AbortController
  #activeIndex = -1
  #elements!: BoundElements
  #ignoreInput = false
  #requestVersion = 0
  #results: HandleSuggestion[] = []
  #searchTimer?: ReturnType<typeof setTimeout>

  connectedCallback() {
    this.#elements = requireElements(this)

    const listboxId = this.#elements.listbox.id || `at-astro-handle-options-${++fieldCount}`
    this.#elements.listbox.id = listboxId
    this.#elements.input.setAttribute("role", "combobox")
    this.#elements.input.setAttribute("aria-autocomplete", "list")
    this.#elements.input.setAttribute("aria-controls", listboxId)
    this.#elements.input.setAttribute("aria-expanded", "false")
    this.#elements.listbox.hidden = true

    this.#elements.input.addEventListener("input", this.#onInput)
    this.#elements.input.addEventListener("keydown", this.#onKeyDown)
    this.#elements.input.addEventListener("blur", this.#onBlur)
    this.#elements.listbox.addEventListener("mousedown", this.#onMouseDown)
    this.#elements.listbox.addEventListener("click", this.#onClick)
    this.#setState("idle")
  }

  disconnectedCallback() {
    clearTimeout(this.#searchTimer)
    this.#abortController?.abort()
    this.#elements.input.removeEventListener("input", this.#onInput)
    this.#elements.input.removeEventListener("keydown", this.#onKeyDown)
    this.#elements.input.removeEventListener("blur", this.#onBlur)
    this.#elements.listbox.removeEventListener("mousedown", this.#onMouseDown)
    this.#elements.listbox.removeEventListener("click", this.#onClick)
  }

  #scheduleSearch() {
    if (this.#ignoreInput) return

    clearTimeout(this.#searchTimer)
    this.#abortController?.abort()
    this.#requestVersion += 1
    this.#clearOptions()

    const query = this.#elements.input.value.trim().replace(/^@/, "")
    if (!query) {
      this.#setState("idle")
      return
    }

    const requestVersion = this.#requestVersion
    this.#setState("loading")
    this.#searchTimer = setTimeout(() => void this.#search(query, requestVersion), searchDelay)
  }

  async #search(query: string, requestVersion: number) {
    const endpoint = this.getAttribute("endpoint")
    if (!endpoint) throw new Error("HandleField requires an endpoint")

    const abortController = new AbortController()
    this.#abortController = abortController

    try {
      const results = await searchHandleSuggestions(endpoint, query, abortController.signal)
      if (requestVersion !== this.#requestVersion) return

      this.#results = results
      if (results.length === 0) {
        this.#setState("empty")
        return
      }

      this.#renderOptions()
      this.#open()
    } catch (error) {
      if (abortController.signal.aborted || requestVersion !== this.#requestVersion) return
      this.#clearOptions()
      this.#setState("error")
      this.dispatchEvent(
        new CustomEvent("atastro:handle-error", {
          bubbles: true,
          detail: error,
        }),
      )
    }
  }

  #renderOptions() {
    const { listbox, template } = this.#elements
    for (const [index, actor] of this.#results.entries()) {
      const fragment = template.content.cloneNode(true) as DocumentFragment
      const option = fragment.firstElementChild
      if (!(option instanceof HTMLLIElement)) continue

      option.id = `${listbox.id}-option-${index}`
      option.dataset.atHandleOption = ""
      option.dataset.did = actor.did
      option.dataset.handle = actor.handle
      option.dataset.index = String(index)
      option.setAttribute("role", "option")
      option.setAttribute("aria-selected", "false")
      this.#bindActor(option, actor)
      listbox.append(option)
    }
  }

  #bindActor(option: HTMLLIElement, actor: HandleSuggestion) {
    const fields = option.querySelectorAll<HTMLElement>("[data-at-field]")
    for (const field of fields) {
      const name = field.dataset.atField
      if (name === "avatar") {
        if (!(field instanceof HTMLImageElement)) {
          throw new Error('The data-at-field="avatar" binding requires an img element')
        }
        field.hidden = !actor.avatar
        if (actor.avatar) field.src = actor.avatar
        else field.removeAttribute("src")
        continue
      }

      if (name !== "did" && name !== "displayName" && name !== "handle") {
        throw new Error(`Unknown HandleOptions field: ${name ?? ""}`)
      }

      const value = actor[name]
      field.textContent = value ?? ""
      field.hidden = value == null
    }
  }

  #handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (this.#results.length === 0) return
      event.preventDefault()
      this.#open()
      this.#setActive(
        nextActiveIndex(
          this.#activeIndex,
          event.key === "ArrowDown" ? 1 : -1,
          this.#results.length,
        ),
      )
      return
    }

    if (event.key === "Enter" && !this.#elements.listbox.hidden && this.#activeIndex >= 0) {
      event.preventDefault()
      this.#select(this.#activeIndex)
      return
    }

    if (event.key === "Escape" && !this.#elements.listbox.hidden) {
      event.preventDefault()
      this.#close()
      return
    }

    if (event.key === "Tab") this.#close()
  }

  #handleBlur() {
    clearTimeout(this.#searchTimer)
    this.#abortController?.abort()
    this.#requestVersion += 1
    this.#close()
    this.#setState("idle")
  }

  #select(index: number) {
    const actor = this.#results[index]
    if (!actor) return

    this.#ignoreInput = true
    this.#elements.input.value = actor.handle
    this.#elements.input.dispatchEvent(new Event("input", { bubbles: true }))
    this.#elements.input.dispatchEvent(new Event("change", { bubbles: true }))
    this.#ignoreInput = false

    this.#clearOptions()
    this.#setState("idle")
    this.dispatchEvent(
      new CustomEvent("atastro:handle-select", {
        bubbles: true,
        detail: actor,
      }),
    )
  }

  #setActive(index: number) {
    const options = this.#elements.listbox.querySelectorAll<HTMLLIElement>(
      ":scope > li[data-at-handle-option]",
    )
    for (const [optionIndex, option] of options.entries()) {
      const active = optionIndex === index
      option.setAttribute("aria-selected", String(active))
      option.toggleAttribute("data-active", active)
    }

    this.#activeIndex = index
    const activeOption = options[index]
    if (activeOption) this.#elements.input.setAttribute("aria-activedescendant", activeOption.id)
    else this.#elements.input.removeAttribute("aria-activedescendant")
  }

  #open() {
    this.#elements.listbox.hidden = false
    this.#elements.input.setAttribute("aria-expanded", "true")
    this.#setState("success")
  }

  #close() {
    this.#elements.listbox.hidden = true
    this.#elements.input.setAttribute("aria-expanded", "false")
    this.#setActive(-1)
    if (this.dataset.state === "success") this.#setState("idle")
  }

  #clearOptions() {
    this.#results = []
    this.#setActive(-1)
    for (const option of this.#elements.listbox.querySelectorAll(
      ":scope > li[data-at-handle-option]",
    )) {
      option.remove()
    }
    this.#close()
  }

  #setState(state: FieldState) {
    this.dataset.state = state
    this.#elements.listbox.setAttribute("aria-busy", String(state === "loading"))
  }
}

if (!customElements.get(elementName)) customElements.define(elementName, HandleFieldElement)
