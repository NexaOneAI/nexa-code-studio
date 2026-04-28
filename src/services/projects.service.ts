/**
 * Servicio de proyectos: API única que internamente usa
 *   - localStore (siempre disponible), o
 *   - Supabase (si hay sesión real y configuración).
 *
 * Nunca lanza si Supabase no está disponible: cae a local.
 */
import type { FileItem } from "@/components/builder/CodeEditor";
import { localStore, type LocalProject } from "@/lib/local-store";
import { supabaseClient } from "@/integrations/supabase/client";
import { canUseSupabase } from "./backend";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export interface ProjectFull extends ProjectSummary {
  prompt: string | null;
  files: FileItem[];
}

function localToFull(p: LocalProject): ProjectFull {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    updated_at: p.updated_at,
    prompt: p.prompt,
    files: p.files,
  };
}

export const projectsService = {
  async list(): Promise<ProjectSummary[]> {
    if (await canUseSupabase()) {
      const { data, error } = await supabaseClient!
        .from("projects")
        .select("id,name,description,updated_at")
        .order("updated_at", { ascending: false });
      if (!error && data) return data;
    }
    return localStore.listProjects().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      updated_at: p.updated_at,
    }));
  },

  async get(id: string): Promise<ProjectFull | null> {
    if (await canUseSupabase()) {
      const { data: proj } = await supabaseClient!
        .from("projects")
        .select("id,name,description,updated_at,prompt")
        .eq("id", id)
        .maybeSingle();
      if (proj) {
        const { data: pf } = await supabaseClient!
          .from("project_files")
          .select("path,content,language")
          .eq("project_id", id);
        return {
          ...proj,
          files: (pf || []) as FileItem[],
        };
      }
    }
    const local = localStore.getProject(id);
    return local ? localToFull(local) : null;
  },

  async save(input: {
    id?: string;
    name: string;
    description?: string | null;
    prompt?: string | null;
    files: FileItem[];
  }): Promise<string> {
    if (await canUseSupabase()) {
      const sb = supabaseClient!;
      const { data: sess } = await sb.auth.getSession();
      const userId = sess.session!.user.id;
      let pid = input.id;
      if (!pid) {
        const { data, error } = await sb
          .from("projects")
          .insert({
            user_id: userId,
            name: input.name,
            description: input.description ?? null,
            prompt: input.prompt ?? null,
          })
          .select("id")
          .single();
        if (error || !data) throw new Error(error?.message || "Error guardando");
        pid = data.id;
      } else {
        await sb
          .from("projects")
          .update({
            name: input.name,
            description: input.description ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pid);
      }
      await sb.from("project_files").delete().eq("project_id", pid!);
      if (input.files.length) {
        await sb.from("project_files").insert(
          input.files.map((f) => ({
            project_id: pid!,
            user_id: userId,
            path: f.path,
            content: f.content,
            language: f.language || "html",
          })),
        );
      }
      // Espejo local para que la app siga funcionando offline.
      localStore.saveProject({ ...input, id: pid });
      return pid!;
    }
    return localStore.saveProject(input).id;
  },

  async remove(id: string): Promise<void> {
    if (await canUseSupabase()) {
      await supabaseClient!.from("project_files").delete().eq("project_id", id);
      await supabaseClient!.from("projects").delete().eq("id", id);
    }
    localStore.deleteProject(id);
  },
};