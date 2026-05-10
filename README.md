# CDRCA

CDRCA is a transpiler and rendering engine designed to simplify the complex process of creating 2D, 3D, and especially 2.5D animations.

---

## A Custom DSL for Animation

Creating compelling animations, whether through traditional frame-by-frame drawing or modern rigging, is challenging. 2.5D animation—which uses 2D assets in a 3D environment—presents its own difficulties, often limiting creators to simple camera pans and movements.

CDRCA aims to solve these problems by providing an intuitive Domain-Specific Language (DSL). It supports multiple programming paradigms (**functional**, **object-oriented**, and a **props-scene-action** model), allowing you to program, command, or simply write out your animation sequence.

---

## Getting Started

You can get started with CDRCA in one of the following ways:

- Download the latest release from the project page.
- Clone the repository: `git clone https://github.com/ISLAH-org/CDRCA.git`
- Install via npm: `npm install cdrca`

To see the language in action, check out the examples here: [CDRCA Examples](https://github.com/Muhammad-Ayyan-no1/CDRCA-animation-dsl/tree/main/examples).

---

## Documentation

Official documentation is currently in development and will be available soon.

---

## Team Paradigm

CDRCA is built to boost productivity for both solo creators and teams. The DSL is designed to be so straightforward that it allows for a clear separation of roles:

- **Technical Artists/Developers:** Define props and the actions they can perform. This process is streamlined by the standard CDRCA library.
- **Writers/Storytellers:** Use the pre-defined props and actions to write the story. They can focus purely on the narrative, defining scenes and character behaviors in a highly reusable and dynamic way.

---

## Basic Syntax Overview

The syntax is designed to be intuitive. If you find it difficult, require tutorials, or have suggestions, please **[open an issue on GitHub](https://github.com/Muhammad-Ayyan-no1/CDRCA-animation-dsl/issues/new)**. The goal is for CDRCA to feel like a natural extension of the creative process, not another complex tool to learn.

### Actions

Actions are defined using the `def action` keyword. You can chain multiple actions together in a single definition.

- **Syntax:**
  ```
  def action <action_name> <prop_name> <action_type> [additional_information]
  ```
- **Example:**
  ```
  def action runFast myCharacter run "fast"
  ```

### Organization

CDRCA uses a header system for organization and imports.

- `@import myPath.cdrca`: Imports a library or tool.
- `@addImport myPath.cdrca`: Inlines the content of another file, as if you had copy-pasted it.

You can also define scenes and add metadata using headers. A header block also implicitly defines a scene, or you can explicitly use the `NextSceneStart` keyword.

- **Header Example:**

  ```
  ! --- MyHeaderKeywords 1 2 3 :: This is a comment ---

  ! --- End ---
  ```

- **Regular Comments:**
  ```
  // Comments similar to JS (JAVASCRIPT) or CPP (C++) or C
  ```

### Further Syntax

For the rest of the syntax, please check the official documentation (once released) or explore the [provided examples](https://github.com/Muhammad-Ayyan-no1/CDRCA-animation-dsl/tree/main/examples).

---

## Ethical Use

CDRCA is an open-source tool intended for everyone. We believe in using technology to foster positive and ethical creativity. The legal terms of use are outlined in the `LICENSE.md` file. As a guiding principle, we ask that you use CDRCA responsibly and refrain from creating content with harmful or negative intentions.

---

## Contributing

CDRCA is an open project, and contributions are welcome\! Feel free to fork the repository, make improvements, and submit a pull request.

### Codebase Structure

- **CDRCA root**
  - `index.js`
  - **Front-end**
    - `index.html`
    - _other stuff_
  - **Back-end**
    - `serverManager.js`
    - **Transpiler**
    - **Servers**
    - **Renderer (server side)**
    - _other stuff_
  - **examples**
    - **basicUsage**
    - **fullDemo**
    - _other stuff_

### Current Collaborators

Currently, the project is being developed and maintained by a solo developer, [Muhammad Ayyan](https://github.com/Muhammad-Ayyan-No1).
