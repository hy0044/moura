import { describe, expect, it, vi } from "vitest";

import { runCommand } from "./run-command.mjs";

describe("runCommand", () => {
  it("runs a normal executable without a shell and returns its output", () => {
    const spawn = vi.fn(() => ({
      status: 0,
      stdout: "standard output",
      stderr: "standard error",
    }));

    expect(
      runCommand("tool", ["argument"], {
        cwd: "/project",
        platform: "linux",
        spawn,
      }),
    ).toEqual({ stdout: "standard output", stderr: "standard error" });
    expect(spawn).toHaveBeenCalledWith("tool", ["argument"], {
      cwd: "/project",
      encoding: "utf8",
      shell: false,
    });
  });

  it("runs a native Windows executable directly without a shell", () => {
    const spawn = vi.fn(() => ({ status: 0, stdout: "", stderr: "" }));

    runCommand("C:\\Program Files\\nodejs\\node.exe", ["--version"], {
      platform: "win32",
      spawn,
    });

    expect(spawn).toHaveBeenCalledWith(
      "C:\\Program Files\\nodejs\\node.exe",
      ["--version"],
      {
        cwd: undefined,
        encoding: "utf8",
        shell: false,
      },
    );
  });

  it.each([".cmd", ".bat"])(
    "runs a Windows %s shim through cmd.exe",
    (extension) => {
      const spawn = vi.fn(() => ({ status: 0, stdout: "", stderr: "" }));
      const shim = `C:\\tools\\pnpm${extension}`;

      runCommand("pnpm", ["pack", "package path"], {
        platform: "win32",
        spawn,
        environment: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
        resolveCommand: () => shim,
      });

      expect(spawn).toHaveBeenCalledWith(
        "C:\\Windows\\System32\\cmd.exe",
        ["/d", "/s", "/c", `"${shim}" "pack" "package path"`],
        {
          cwd: undefined,
          encoding: "utf8",
          shell: false,
        },
      );
    },
  );

  it("keeps a resolved Windows native executable shell-free", () => {
    const spawn = vi.fn(() => ({ status: 0, stdout: "", stderr: "" }));

    runCommand("node", ["--version"], {
      platform: "win32",
      spawn,
      resolveCommand: () => "C:\\Program Files\\nodejs\\node.exe",
    });

    expect(spawn).toHaveBeenCalledWith(
      "C:\\Program Files\\nodejs\\node.exe",
      ["--version"],
      {
        cwd: undefined,
        encoding: "utf8",
        shell: false,
      },
    );
  });

  it("includes status, stdout, and stderr when a command fails", () => {
    const spawn = vi.fn(() => ({
      status: 2,
      stdout: "partial output",
      stderr: "failure detail",
    }));

    expect(() => runCommand("tool", [], { spawn })).toThrow(
      /status 2\npartial outputfailure detail/u,
    );
  });

  it("reports a spawn failure with its cause", () => {
    const cause = new Error("not found");
    const spawn = vi.fn(() => ({
      status: null,
      stdout: "",
      stderr: "",
      error: cause,
    }));

    expect(() => runCommand("missing", [], { spawn })).toThrow(
      /Could not run missing: not found/u,
    );
  });
});
