import * as api from "@prague/container-definitions";
import { GitManager, Historian, ICredentials, IGitCache } from "@prague/services-client";
import { DocumentDeltaConnection } from "@prague/socket-storage-shared";
import Axios from "axios";
import * as io from "socket.io-client";
import { DocumentStorageService } from "./blobStorageService";
import { DeltaStorageService, DocumentDeltaStorageService } from "./deltaStorageService";
import { NullBlobtorageService } from "./nullBlobStorageService";
import { TokenProvider } from "./tokens";

/**
 * The DocumentService manages the Socket.IO connection and manages routing requests to connected
 * clients
 */
export class DocumentService implements api.IDocumentService {
    constructor(
        protected ordererUrl: string,
        private deltaStorageUrl: string,
        private gitUrl: string,
        private errorTracking: api.IErrorTrackingService,
        private disableCache: boolean,
        private historianApi: boolean,
        private directCredentials: ICredentials | undefined,
        private gitCache: IGitCache | null | undefined) {}

    public async createTokenProvider(tokens: { [name: string]: string }): Promise<api.ITokenProvider> {
        return new TokenProvider(tokens.jwt);
    }

    public async connectToStorage(
        tenantId: string,
        id: string,
        tokenProvider: api.ITokenProvider): Promise<api.IDocumentStorageService> {

        if (this.gitUrl === undefined) {
            return new NullBlobtorageService();
        }

        // Craft credentials - either use the direct credentials (i.e. a GitHub user + PAT) - or make use of our
        // tenant token
        let credentials: ICredentials | undefined;
        if (this.directCredentials) {
            credentials = this.directCredentials;
        } else {
            const token = (tokenProvider as TokenProvider).token;
            if (token) {
                credentials = {
                    password: token,
                    user: tenantId,
                };
            }
        }

        const historian = new Historian(
            this.gitUrl,
            this.historianApi,
            this.disableCache,
            credentials);
        const gitManager = new GitManager(historian);

        // Insert cached seed data
        if (this.gitCache) {
            for (const ref of Object.keys(this.gitCache.refs)) {
                gitManager.addRef(ref, this.gitCache.refs[ref]);
            }

            for (const commit of this.gitCache.commits) {
                gitManager.addCommit(commit);
            }

            for (const tree of this.gitCache.trees) {
                gitManager.addTree(tree);
            }

            for (const blob of this.gitCache.blobs) {
                gitManager.addBlob(blob);
            }
        }

        return new DocumentStorageService(id, gitManager);
    }

    public async connectToDeltaStorage(
        tenantId: string,
        id: string,
        tokenProvider: api.ITokenProvider): Promise<api.IDocumentDeltaStorageService> {

        const deltaStorage = new DeltaStorageService(this.deltaStorageUrl);
        return new DocumentDeltaStorageService(tenantId, id, tokenProvider, deltaStorage);
    }

    public async connectToDeltaStream(
        tenantId: string,
        id: string,
        tokenProvider: api.ITokenProvider,
        client: api.IClient): Promise<api.IDocumentDeltaConnection> {
        const token = (tokenProvider as TokenProvider).token;
        return DocumentDeltaConnection.Create(tenantId, id, token, io, client, this.ordererUrl);
    }

    public async branch(tenantId: string, id: string, tokenProvider: api.ITokenProvider): Promise<string> {
        let headers: {Authorization: string} | null = null;
        const token = (tokenProvider as TokenProvider).token;
        if (token) {
            headers = {
                Authorization: `Basic ${Buffer.from(`${tenantId}:${token}`)
                    .toString("base64")}`,
            };
        }

        const result = await Axios.post<string>(`${this.ordererUrl}/documents/${tenantId}/${id}/forks`, { headers });
        return result.data;
    }

    public getErrorTrackingService() {
        return this.errorTracking;
    }
}
