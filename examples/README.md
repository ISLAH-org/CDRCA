# EXAMPLES ARE UNDER DEVELOPMENT

## The project is not that mature examples will come soon

## Plugin-capable syntax examples (new)

### 1) File-level plugin declarations

```cdrca
@requires myInlinePlugin analyticsPlugin
@syntaxPlugin syntaxPluginExample
```

### 2) Header-level plugin declarations

```cdrca
!--- SCENE Intro requires myInlinePlugin syntaxPlugin syntaxPluginExample :: demo ---
...
!---END---
```

### 3) Embedded plugin definition (in-memory, no disk file)

```cdrca
plugin myInlinePlugin scope file trusted true {
  on 20 before parse => ctx.value;
  on 10 after fullTranspile => "/* from embedded plugin */\n" + ctx.value;
}
```

`on` mini-language:
- `on <priority> <type> <process> => <jsExpression>;`
- `type/process` can target existing lifecycle hooks (`before parse`, `after fullTranspile`) and syntax hooks.
