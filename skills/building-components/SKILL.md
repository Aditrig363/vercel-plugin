---
name: building-components
description: Guide for building modern, accessible, and composable UI components. Use when building new components, implementing accessibility, creating composable APIs, setting up design tokens, publishing to npm/registry, or writing component documentation.
metadata:
  priority: 6
  docs:
    - "https://components.build"
  pathPatterns:
    - 'components/ui/**'
    - 'src/components/ui/**'
    - 'packages/ui/**'
    - 'packages/components/**'
    - 'lib/components/**'
    - 'src/lib/components/**'
  importPatterns:
    - '@radix-ui/*'
    - '@radix-ui/react-slot'
    - 'class-variance-authority'
    - '@radix-ui/react-use-controllable-state'
  bashPatterns:
    - '\bnpx\s+shadcn@latest\s+add\b'
    - '\bnpx\s+shadcn\s+add\b'
  promptSignals:
    phrases:
      - "build a component"
      - "building components"
      - "component library"
      - "design system"
      - "composable component"
      - "compound component"
      - "asChild"
      - "as child"
      - "polymorphic component"
      - "data-slot"
      - "data-state"
      - "design tokens"
      - "component registry"
      - "shadcn registry"
      - "controlled uncontrolled"
      - "component accessibility"
      - "ARIA pattern"
      - "keyboard navigation"
      - "focus management"
      - "focus trap"
    allOf:
      - [component, composable]
      - [component, accessible]
      - [component, reusable]
      - [component, library]
      - [component, registry]
      - [component, publish]
      - [component, npm]
      - [design, tokens]
      - [design, system]
      - [keyboard, navigation]
      - [focus, trap]
      - [focus, management]
      - [ARIA, role]
      - [ARIA, attribute]
      - [data, attribute, styling]
      - [slot, pattern]
      - [variant, cva]
      - [controlled, uncontrolled]
    anyOf:
      - "component"
      - "composable"
      - "accessible"
      - "ARIA"
      - "design tokens"
      - "registry"
      - "shadcn"
      - "radix"
    noneOf:
      - "server component"
      - "route handler"
      - "API route"
    minScore: 6
  validate:
    - pattern: <div\s+onClick
      message: 'Use semantic HTML elements like <button> instead of <div onClick> for interactive elements — they provide built-in keyboard support and accessibility'
      severity: error
    - pattern: className=.*\{.*styles\.
      message: 'Consider using the cn() utility (clsx + tailwind-merge) for composable className merging instead of CSS modules'
      severity: recommended
      skipIfFileContains: module\.css
retrieval:
  aliases:
    - UI components
    - component library
    - design system
    - composable components
  intents:
    - build component
    - create component library
    - implement accessibility
    - set up design tokens
    - publish components
  entities:
    - Radix UI
    - shadcn/ui
    - CVA
    - design tokens
    - compound component

---

# Building Components

Guide for building modern, accessible, and composable UI components.

## Artifact Taxonomy

### Primitive

The lowest-level building block providing behavior and accessibility without styling. Completely headless, single responsibility, composable into styled components, ships with exhaustive a11y behavior.

Examples: Radix UI Primitives, React Aria Components, Base UI, Headless UI.

### Component

A styled, reusable UI unit that adds visual design to primitives. Includes default styling but remains override-friendly. Clear props API, keyboard accessible, composable.

Examples: shadcn/ui, Material UI, Ant Design.

### Block

An opinionated, production-ready composition of components solving a concrete use case (pricing table, auth screen, AI chat panel). Strong defaults, copy-paste friendly, easily branded/themed.

### Template

Multi-page collection bundling pages, routing, shared layouts, providers, and project structure. Complete starting points — fork and customize.

### Utility (Non-visual)

Helpers for developer ergonomics: hooks (`useControllableState`, `useId`), class utilities, keybinding helpers, focus scopes. Side-effect free, testable in isolation.

## Core Principles

### Composability and Reusability

Favor composition over inheritance. Components expose a clear API via props/slots allowing customization by plugging in child elements or callbacks.

### Accessible by Default

Use semantic HTML elements. Augment with WAI-ARIA attributes. Ensure keyboard navigation and focus management. Accessibility is a baseline feature, not optional.

### Customizability and Theming

Avoid hard-coding visual styles. Provide CSS variables, documented class names, or style props. Components should fit into any brand without fighting default styles.

### Lightweight and Performant

Minimize dependencies and unnecessary re-renders. Keep components lean. Consider virtualization for data-intensive components but keep such features optional.

### Transparency and Code Ownership

Components should not be black boxes. Embrace source visibility — readable code, source maps, thorough documentation. Support copy-and-paste distribution.

## Composition

Break monolithic components into smaller, focused subcomponents using the compound component pattern.

### Making a Component Composable

Instead of passing all data as props to a single component:

```tsx
// ❌ Tightly coupled, hard to customize
<Accordion data={data} />
```

Break it into Root, Item, Trigger, and Content:

```tsx
import * as Accordion from "@/components/ui/accordion";

<Accordion.Root open={false} setOpen={() => {}}>
  {data.map((item) => (
    <Accordion.Item key={item.title}>
      <Accordion.Trigger>{item.title}</Accordion.Trigger>
      <Accordion.Content>{item.content}</Accordion.Content>
    </Accordion.Item>
  ))}
</Accordion.Root>
```

### Root Component

Wraps everything, manages shared state via Context, extends default HTML attributes:

```tsx
type AccordionRootProps = React.ComponentProps<"div"> & {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const AccordionContext = createContext<AccordionRootProps>({
  open: false,
  setOpen: () => {},
});

export const Root = ({ children, open, setOpen, ...props }: AccordionRootProps) => (
  <AccordionContext.Provider value={{ open, setOpen }}>
    <div {...props}>{children}</div>
  </AccordionContext.Provider>
);
```

### Naming Conventions

- **Root** — main container, manages shared state/context
- **Trigger** — element that initiates an action (open, close, toggle)
- **Content** — element shown/hidden
- **Header/Body/Footer** — structured content areas
- **Title/Description** — informational components

## The asChild Pattern

Popularized by Radix UI. When `asChild={true}`, the component merges its props/behaviors with its immediate child instead of rendering its default element:

```tsx
// Without asChild: nested buttons
<Dialog.Trigger>
  <button>Open</button>
</Dialog.Trigger>
// Renders: <button><button>Open</button></button>

// With asChild: single merged element
<Dialog.Trigger asChild>
  <button>Open</button>
</Dialog.Trigger>
// Renders: <button data-state="closed">Open</button>
```

Benefits: semantic HTML, clean DOM, design system integration, behavior composition.

**Pitfalls:**
- Always spread props in child components: `({ children, ...props }) => <button {...props}>{children}</button>`
- Only pass a single child element (no fragments, no multiple children)

## Polymorphism (The `as` Prop)

Change the rendered HTML element while preserving component functionality:

```tsx
<Button as="a" href="/home">Go Home</Button>
<Button as="button" type="submit">Submit</Button>
```

Type-safe implementation:

```tsx
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<E>;

function Component<E extends React.ElementType = "div">({
  as, children, ...props
}: PolymorphicProps<E>) {
  const Element = as || "div";
  return <Element {...props}>{children}</Element>;
}
```

**`as` vs `asChild`:** Use `as` for simple element switching. Use `asChild` + Radix `Slot` for component composition with intelligent prop merging and ref forwarding.

## TypeScript Patterns

### Extending HTML Attributes

Every component should extend native HTML attributes:

```tsx
export type CardRootProps = React.ComponentProps<"div"> & {
  variant?: "default" | "outlined";
};

export const CardRoot = ({ variant = "default", ...props }: CardRootProps) => (
  <div {...props} />
);
```

### Best Practices

- **Always spread props last** so users can override defaults
- **Avoid prop name conflicts** with HTML attributes (use `heading` not `title`)
- **Export prop types** as `<ComponentName>Props`
- **Document custom props** with JSDoc comments

## State Management

### Controlled vs Uncontrolled

Support both modes using `useControllableState` from Radix:

```tsx
import { useControllableState } from "@radix-ui/react-use-controllable-state";

type StepperProps = {
  value: number;
  defaultValue: number;
  onValueChange: (value: number) => void;
};

export const Stepper = ({ value: controlledValue, defaultValue, onValueChange }: StepperProps) => {
  const [value, setValue] = useControllableState({
    prop: controlledValue,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });

  return (
    <div>
      <p>{value}</p>
      <button onClick={() => setValue(value + 1)}>Increment</button>
    </div>
  );
};
```

## Accessibility

### Semantic HTML First

```tsx
// ❌ Don't reinvent the wheel
<div onClick={handleClick} className="button">Click me</div>

// ✅ Use semantic elements
<button onClick={handleClick}>Click me</button>
```

### Keyboard Navigation

Every interactive element must be keyboard accessible:

```tsx
function Menu() {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": focusNextItem(); break;
      case "ArrowUp": focusPreviousItem(); break;
      case "Home": focusFirstItem(); break;
      case "End": focusLastItem(); break;
      case "Escape": closeMenu(); break;
    }
  };
  return <div role="menu" onKeyDown={handleKeyDown}>{/* items */}</div>;
}
```

### ARIA Patterns

- **Roles** define what an element is: `role="menu"`, `role="dialog"`, `role="alert"`
- **States** describe current state: `aria-checked`, `aria-expanded`, `aria-selected`
- **Properties** provide info: `aria-label`, `aria-controls`, `aria-required`, `aria-invalid`

Rules: Don't use ARIA if semantic HTML works. Don't change native semantics. All interactive elements must be keyboard accessible. All must have accessible names.

### Focus Management

- **Focus visible**: Show focus indicators only for keyboard: `*:focus-visible { outline: 2px solid var(--color-focus); }`
- **Focus trapping**: Keep focus within modals/dialogs — cycle between first and last focusable elements on Tab
- **Focus restoration**: Return focus to trigger element when modal/dialog closes

### Component Patterns

**Modal/Dialog**: Store previous focus, focus first focusable element on open, trap focus with Tab, close on Escape, restore focus on close.

**Forms**: Always pair `<input>` with `<label>`. Use `aria-required`, `aria-invalid`, `aria-describedby` for error messages. Use `<fieldset>/<legend>` for groups.

**Color**: Never convey information through color alone. Always pair with text/icon. Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text.

**Touch targets**: Minimum 44x44px. Allow zoom: never use `maximum-scale=1` or `user-scalable=no`.

## Data Attributes

### data-state for Visual States

Expose component state declaratively instead of multiple className props:

```tsx
<div data-state={isOpen ? "open" : "closed"} className={cn("transition-all", className)} {...props} />
```

Style from outside with Tailwind:
```tsx
<Dialog className="data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
```

### data-slot for Component Identification

Stable identifiers for parent-child targeting:

```tsx
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("flex flex-col gap-6", "has-[>[data-slot=checkbox-group]]:gap-3", className)}
      {...props}
    />
  );
}
```

Naming: kebab-case, specific, match component purpose, avoid implementation details.

## Styling

### The cn Utility

Combines `clsx` (conditional logic) and `tailwind-merge` (intelligent conflict resolution):

```tsx
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Class Ordering

1. Base styles (always applied)
2. Variant styles (based on props)
3. Conditional styles (based on state)
4. User overrides (className prop)

```tsx
className={cn('base-styles', variant && variantStyles, isActive && 'active', className)}
```

### Class Variance Authority (CVA)

Declarative variant management for complex components:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

## Design Tokens

Semantic CSS variables separating what something is from how it looks:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
}
```

## Distribution

### Registry (Source Distribution)

Distribute source code directly. Users copy into their projects via CLI:

```bash
npx shadcn@latest add https://your-registry.vercel.app/metric-card.json
```

Create: components + public JSON endpoint + CLI. Or use the shadcn ecosystem.

### NPM (Package Distribution)

Versioned, pre-built code installed as dependency:

```bash
npm install @acme/ui-components
```

For Tailwind-based packages, users need `@source "../node_modules/@acme/ui-components"` in their CSS.

### Marketplaces

Platforms like 21st.dev provide hosting, previews, discovery, and unified CLI installation.

## Documentation

Essential sections for component docs:

1. **Overview** — What it does, when to use it
2. **Demo/Preview** — Live component with source code
3. **Installation** — Single copy-paste command
4. **Features** — Key capabilities list
5. **Examples** — Variants, states, composition, responsive behavior
6. **Props/API Reference** — Name, type, default, required, description for each prop
7. **Accessibility** — Keyboard navigation, ARIA attributes, focus management
8. **Changelog** — Semantic versioning, migration guides for breaking changes
