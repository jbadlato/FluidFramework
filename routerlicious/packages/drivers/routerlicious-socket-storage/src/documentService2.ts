import * as api from "@prague/container-definitions";
import { ICredentials } from "@prague/services-client";
import { DocumentService } from "./documentService";
import { TokenProvider } from "./tokens";
import { WSDeltaConnection } from "./wsDeltaConnection";

/**
 * The DocumentService manages the Socket.IO connection and manages routing requests to connected
 * clients
 */
export class DocumentService2 extends DocumentService {
    constructor(
        ordererUrl: string,
        deltaStorageUrl: string,
        gitUrl: string,
        errorTracking: api.IErrorTrackingService,
        disableCache: boolean, historianApi: boolean,
        directCredentials: ICredentials | undefined) {
        super(ordererUrl, deltaStorageUrl, gitUrl, errorTracking, disableCache, historianApi, directCredentials, null);
    }
    public async connectToDeltaStream(
        tenantId: string,
        id: string,
        tokenProvider: api.ITokenProvider,
        client: api.IClient): Promise<api.IDocumentDeltaConnection> {
        const token = (tokenProvider as TokenProvider).token;
        return WSDeltaConnection.Create(tenantId, id, token, client, this.ordererUrl);
    }
}
