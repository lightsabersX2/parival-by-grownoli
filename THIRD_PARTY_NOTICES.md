# Third-party notices

Parival by Grownoli is licensed under the Apache License 2.0 (see `LICENSE`). The plugin also ships software and fonts made by others, all inside the built local page in `skills/local-page/app/`. This file lists each one with its licence and copyright notice. The scripts in `skills/*/scripts/` use only Node's and Python's standard libraries and contain no third-party code.

| Part | Version | Licence | Where it is |
|---|---|---|---|
| Vue | 3.5.45 | MIT | the page's JavaScript |
| marked | 18.2.0 | MIT | the page's JavaScript |
| DOMPurify | 3.4.17 | Apache-2.0, chosen from its dual licence MPL-2.0 OR Apache-2.0 | the page's JavaScript |
| Babel helpers, compiled into DOMPurify | | MIT | the page's JavaScript |
| Tailwind CSS | 4.3.5 | MIT | the page's stylesheet |
| Vite, its module preload helper | 8.3.8 | MIT | the page's JavaScript |
| @vitejs/plugin-vue, its export helper | 6.0.11 | MIT | the page's JavaScript |
| Lucide, the panel icon in the sidebar button | | ISC | the page's JavaScript |
| Bricolage Grotesque, packaged by Fontsource | 5.3.0 | SIL Open Font License 1.1 | font files in `assets/` |
| DM Sans, packaged by Fontsource | 5.3.0 | SIL Open Font License 1.1 | font files in `assets/` |

None of these licences conflicts with the Apache License 2.0. The fonts stay under the SIL Open Font License and are not relicensed.

Only what ends up in the plugin is listed. Tools used to build the page, such as TypeScript, vue-tsc and Rolldown, are not shipped.

## MIT License

Applies to Vue, marked, the Babel helpers, Tailwind CSS, Vite and @vitejs/plugin-vue, each under its own copyright notice:

- Vue: Copyright (c) 2018-present, Yuxi (Evan) You
- marked: Copyright (c) 2018+, MarkedJS (https://github.com/markedjs/). Copyright (c) 2011-2018, Christopher Jeffrey (https://github.com/chjj/)
- Babel helpers: Copyright (c) 2014-present Sebastian McKenzie and other contributors. Copyright (c) 2014-present, Facebook, Inc.
- Tailwind CSS: Copyright (c) Tailwind Labs, Inc.
- Vite: Copyright (c) 2019-present, VoidZero Inc. and Vite contributors
- @vitejs/plugin-vue: Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Apache License 2.0

Applies to DOMPurify: (c) Cure53 and other contributors. The full text is in `LICENSE`.

## ISC License

Applies to Lucide: Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## SIL Open Font License 1.1

Applies to the two font families, each under its own copyright notice:

- Bricolage Grotesque: Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage)
- DM Sans: Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)

```
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
